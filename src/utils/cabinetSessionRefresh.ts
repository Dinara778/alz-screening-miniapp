import { getPaymentsApiUrl } from './telegramPayments';
import {
  clearCabinetSession,
  hasCabinetSessionTokens,
  isAccessTokenFresh,
  readCabinetSession,
  saveCabinetSession,
  type CabinetSession,
} from './cabinetSessionStorage';

type RefreshOutcome =
  | { kind: 'ok'; session: CabinetSession }
  | { kind: 'auth_failed' }
  | { kind: 'transient' };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function refreshViaServer(refreshToken: string): Promise<RefreshOutcome> {
  const api = getPaymentsApiUrl();
  if (!api) return { kind: 'transient' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      access_token?: string;
      refresh_token?: string;
    };
    if (res.status === 401) return { kind: 'auth_failed' };
    if (!res.ok || !json.ok || !json.access_token || !json.refresh_token) {
      return { kind: 'transient' };
    }
    const stored = readCabinetSession();
    return {
      kind: 'ok',
      session: saveCabinetSession(
        { access_token: json.access_token, refresh_token: json.refresh_token },
        stored?.email ?? undefined,
      ),
    };
  } catch {
    return { kind: 'transient' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Вернуть живой access_token. Если JWT истёк — обновить через refresh_token на сервере.
 * Сессию стираем только если refresh тоже неудачен (или пользователь нажал «Выйти»).
 */
export async function ensureFreshCabinetSession(): Promise<CabinetSession | null> {
  const stored = readCabinetSession();
  if (!hasCabinetSessionTokens(stored)) return null;

  if (isAccessTokenFresh(stored)) return stored;

  if (!refreshInFlight) {
    refreshInFlight = refreshViaServer(stored!.refresh_token).finally(() => {
      refreshInFlight = null;
    });
  }

  const refreshed = await refreshInFlight;
  if (refreshed.kind === 'ok') return refreshed.session;
  if (refreshed.kind === 'auth_failed') {
    clearCabinetSession();
    return null;
  }

  // Сеть/502/таймаут — не выкидываем из аккаунта, остаёмся с сохранёнными токенами.
  return stored;
}
