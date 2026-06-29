import { getPaymentsApiUrl } from './telegramPayments';

export type FunnelSyncPayload = {
  email: string;
  visitId: string;
  lastScreen: string;
  screensPath?: string;
  status?: 'in_progress' | 'completed' | 'abandoned';
  exitReason?: string;
  assessmentSessionId?: string;
};

function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return Boolean(e) && e.includes('@') && e.length <= 254;
}

/** Сохранить email и экран воронки в Supabase. Ошибки не ломают UX. */
export async function syncFunnelToSupabase(
  payload: FunnelSyncPayload,
  opts?: { beacon?: boolean },
): Promise<void> {
  const email = payload.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email) || !payload.visitId?.trim()) return;

  const api = getPaymentsApiUrl();
  if (!api) return;

  const url = `${api.replace(/\/$/, '')}/api/sync-funnel`;
  const body = JSON.stringify({
    email,
    visitId: payload.visitId,
    lastScreen: payload.lastScreen,
    screensPath: payload.screensPath,
    status: payload.status ?? 'in_progress',
    exitReason: payload.exitReason,
    assessmentSessionId: payload.assessmentSessionId,
  });

  try {
    if (opts?.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[supabase-funnel] failed', res.status, text.slice(0, 200));
    }
  } catch (e) {
    console.warn('[supabase-funnel] network error', e);
  }
}
