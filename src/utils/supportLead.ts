import { getPaymentsApiUrl } from './telegramPayments';

export type SupportLeadPayload = {
  email: string;
  message: string;
  topic?: string;
  sessionId?: string;
  screen?: string;
};

export async function sendSupportLead(
  payload: SupportLeadPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { ok: false, error: 'Сервер поддержки недоступен. Напишите на hello@cortalab.ru' };
  }

  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/support-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      const raw = typeof json.error === 'string' ? json.error.trim() : '';
      const looksLikeHtml = !raw || raw.startsWith('<') || /service unavailable/i.test(raw);
      return {
        ok: false,
        error: looksLikeHtml
          ? `Не удалось отправить. Напишите напрямую на hello@cortalab.ru`
          : raw || `Не удалось отправить (код ${res.status})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Сеть недоступна. Попробуйте позже или напишите на hello@cortalab.ru' };
  }
}
