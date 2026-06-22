import type { TelegramInvoiceProduct } from './telegramPayments';
import { getPaymentsApiUrl, reportPaidStorageKey } from './telegramPayments';
import { robokassaReturnSessionId } from './storage';
import { stripPaymentQueryFromUrl } from './appReload';

export type WebPaymentResult =
  | { status: 'already_paid' }
  | { status: 'redirected'; paymentUrl: string }
  | { status: 'pending_setup'; message: string }
  | { status: 'error'; message: string };

const trimApi = (url: string) => url.replace(/\/$/, '');

export async function openWebPayment(
  product: TelegramInvoiceProduct,
  sessionId: string,
): Promise<WebPaymentResult> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { status: 'error', message: 'Сервер оплаты не настроен.' };
  }

  try {
    const res = await fetch(`${trimApi(api)}/invoice-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, product }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      alreadyPaid?: boolean;
      paymentUrl?: string;
    };

    if (res.status === 503 && data.code === 'robokassa_pending') {
      return {
        status: 'pending_setup',
        message:
          data.error ||
          'Оплата картой подключается. Напишите hello@bookvolon.ru — откроем отчёт вручную после оплаты.',
      };
    }
    if (!res.ok) {
      return { status: 'error', message: data.error || `Ошибка сервера (${res.status})` };
    }
    if (data.alreadyPaid) {
      localStorage.setItem(reportPaidStorageKey(sessionId), '1');
      return { status: 'already_paid' };
    }
    if (data.paymentUrl) {
      window.location.assign(data.paymentUrl);
      return { status: 'redirected', paymentUrl: data.paymentUrl };
    }
    return { status: 'error', message: 'Сервер не вернул ссылку на оплату.' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Нет связи с сервером.' };
  }
}

export async function verifyWebReportPayment(sessionId: string): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; message: string }
> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { ok: false, message: 'Сервер оплаты не настроен.' };
  }

  try {
    const res = await fetch(`${trimApi(api)}/payment-recover-session-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, product: 'full_report' }),
    });
    const data = (await res.json()) as { paid?: boolean; sessionId?: string };
    if (res.ok && data.paid && data.sessionId) {
      localStorage.setItem(reportPaidStorageKey(data.sessionId), '1');
      return { ok: true, sessionId: data.sessionId };
    }
    return {
      ok: false,
      message:
        'Оплату пока не видим на сервере. Если деньги списались — напишите hello@bookvolon.ru с датой и email.',
    };
  } catch {
    return { ok: false, message: 'Нет связи с сервером. Проверьте интернет и повторите.' };
  }
}

/** Возврат с Робокассы: ?robokassa=success&sessionId=… */
export async function recoverRobokassaPaymentFromUrl(): Promise<{
  sessionId: string;
  product: 'full_report';
} | null> {
  const sessionId = robokassaReturnSessionId();
  if (!sessionId) return null;
  const verified = await verifyWebReportPayment(sessionId);
  stripPaymentQueryFromUrl();
  if (!verified.ok) return null;
  return { sessionId: verified.sessionId, product: 'full_report' };
}
