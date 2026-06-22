import type { ParticipantProfile } from '../types';
import { getPaymentsApiUrl } from './telegramPayments';

export type ConsultationLeadNotifyResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped?: false; emailSent?: boolean; telegramSent?: boolean }
  | { ok: false; reason: 'http' | 'not_configured'; message?: string };

const trimApi = (url: string) => url.replace(/\/$/, '');

/**
 * Уведомление сервера о заявке на разбор (письмо / Telegram админу).
 * В Mini App передаётся initData; на сайте — только email и анкета.
 */
export const notifyConsultationLeadServer = async (
  consultationEmail: string,
  sessionId: string,
  participant?: ParticipantProfile,
): Promise<ConsultationLeadNotifyResult> => {
  const apiUrl = getPaymentsApiUrl();
  if (!apiUrl) {
    return { ok: true, skipped: true };
  }

  const body: Record<string, unknown> = {
    consultationEmail,
    sessionId,
    participant,
  };
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) {
    body.initData = tg.initData;
  }

  try {
    const res = await fetch(`${trimApi(apiUrl)}/consultation-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
