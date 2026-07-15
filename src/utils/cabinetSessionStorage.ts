export type CabinetSession = {
  access_token: string;
  refresh_token: string;
  email: string | null;
};

const STORAGE_KEY = 'corta-cabinet-session';

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function emailFromAccessToken(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken);
  const email = payload?.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function accessTokenExpiresAt(accessToken: string): number | null {
  const exp = decodeJwtPayload(accessToken)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

/** Есть сохранённые токены (ещё не вышли из ЛК). Access JWT может быть уже просрочен. */
export function hasCabinetSessionTokens(session: CabinetSession | null): boolean {
  return Boolean(session?.access_token && session?.refresh_token);
}

/** Access JWT ещё жив (с запасом 30 сек). */
export function isAccessTokenFresh(session: CabinetSession | null): boolean {
  if (!session?.access_token) return false;
  const expiresAt = accessTokenExpiresAt(session.access_token);
  if (!expiresAt) return true;
  return expiresAt > Date.now() + 30_000;
}

/** @deprecated используйте hasCabinetSessionTokens + isAccessTokenFresh / ensureFreshCabinetSession */
export function isCabinetSessionValid(session: CabinetSession | null): boolean {
  return hasCabinetSessionTokens(session) && isAccessTokenFresh(session);
}

export function saveCabinetSession(
  tokens: { access_token: string; refresh_token: string },
  emailHint?: string,
): CabinetSession {
  const session: CabinetSession = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    email: emailHint?.trim().toLowerCase() || emailFromAccessToken(tokens.access_token),
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function readCabinetSession(): CabinetSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CabinetSession;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCabinetSession(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
