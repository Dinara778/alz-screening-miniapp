import type { ParticipantProfile } from '../types';

export type ConsultationLeadNotifyResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped?: false; emailSent?: boolean; telegramSent?: boolean }
  | { ok: false; reason: 'http' | 'not_configured'; message?: string };

const trimApi = (url: string) => url.replace(/\/$/, '');

/**
 * Уведомление сервера оплат о заявке на разбор (письмо на hello@bookvolon.ru и/или Telegram админу).
 * Только внутри Telegram Mini App с валидным initData — как и /invoice.
 */
export const notifyConsultationLeadServer = async (
  consultationEmail: string,
  sessionId: string,
  participant?: ParticipantProfile,
): Promise<ConsultationLeadNotifyResult> => {
  const apiUrl = (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim();
  const tg = window.Telegram?.WebApp;
  if (!apiUrl || !tg?.initData) {
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch(`${trimApi(apiUrl)}/consultation-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        consultationEmail,
        sessionId,
        participant,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      emailSent?: boolean;
      telegramSent?: boolean;
      error?: string;
    };

    if (res.status === 503 && data?.error) {
      return { ok: false, reason: 'not_configured', message: data.error };
    }
    if (!res.ok) {
      return { ok: false, reason: 'http', message: data?.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      emailSent: Boolean(data.emailSent),
      telegramSent: Boolean(data.telegramSent),
    };
  } catch (e) {
    return { ok: false, reason: 'http', message: e instanceof Error ? e.message : String(e) };
  }
};
