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
      return {
        ok: false,
        error: json.error || `Не удалось отправить (код ${res.status})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Сеть недоступна. Попробуйте позже или напишите на hello@cortalab.ru' };
  }
}
