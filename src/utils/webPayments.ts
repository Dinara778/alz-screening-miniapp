import type { TelegramInvoiceProduct } from './telegramPayments';
import {
  consultationPaidStorageKey,
  getPaymentsApiUrl,
  reportPaidStorageKey,
} from './telegramPayments';
import {
  clearRobokassaReturnSession,
  peekRobokassaReturnInvId,
  peekRobokassaReturnProduct,
  peekRobokassaReturnProof,
  peekRobokassaReturnSessionId,
  rememberRobokassaPendingInvId,
  rememberRobokassaPendingProduct,
} from './paymentReturn';
import { stripPaymentQueryFromUrl } from './appReload';

export type WebPaymentResult =
  | { status: 'already_paid' }
  | { status: 'redirected'; paymentUrl: string }
  | { status: 'pending_setup'; message: string }
  | { status: 'error'; message: string };

export type RobokassaPaymentRecovery = {
  sessionId: string;
  product: TelegramInvoiceProduct;
};

const trimApi = (url: string) => url.replace(/\/$/, '');

function markWebProductPaid(sessionId: string, product: TelegramInvoiceProduct): void {
  if (product === 'full_report') {
    localStorage.setItem(reportPaidStorageKey(sessionId), '1');
    return;
  }
  localStorage.setItem(consultationPaidStorageKey(sessionId), '1');
  window.dispatchEvent(new Event('consultation-paid'));
}

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
      invId?: number;
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
      markWebProductPaid(sessionId, product);
      return { status: 'already_paid' };
    }
    if (data.paymentUrl) {
      rememberRobokassaPendingProduct(product);
      if (data.invId != null) rememberRobokassaPendingInvId(data.invId);
      window.location.assign(data.paymentUrl);
      return { status: 'redirected', paymentUrl: data.paymentUrl };
    }
    return { status: 'error', message: 'Сервер не вернул ссылку на оплату.' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Нет связи с сервером.' };
  }
}

export async function verifyWebProductPayment(
  sessionId: string,
  product: TelegramInvoiceProduct,
): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { ok: false, message: 'Сервер оплаты не настроен.' };
  }

  try {
    const res = await fetch(`${trimApi(api)}/payment-recover-session-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, product }),
    });
    const data = (await res.json()) as { paid?: boolean; sessionId?: string };
    if (res.ok && data.paid && data.sessionId) {
      markWebProductPaid(data.sessionId, product);
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

async function verifyWebPaymentByInvId(
  invId: string,
): Promise<{ ok: true; sessionId: string; product: TelegramInvoiceProduct } | { ok: false }> {
  const api = getPaymentsApiUrl();
  if (!api) return { ok: false };

  const proof = peekRobokassaReturnProof();

  try {
    const res = await fetch(`${trimApi(api)}/payment-recover-inv-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invId,
        ...(proof && proof.invId === invId
          ? {
              outSum: proof.outSum,
              signatureValue: proof.signatureValue,
              shp: proof.shp,
            }
          : {}),
      }),
    });
    const data = (await res.json()) as {
      paid?: boolean;
      sessionId?: string;
      product?: TelegramInvoiceProduct;
    };
    if (res.ok && data.paid && data.sessionId && data.product) {
      markWebProductPaid(data.sessionId, data.product);
      return { ok: true, sessionId: data.sessionId, product: data.product };
    }
  } catch {
    /* ignore */
  }
  return { ok: false };
}

/** @deprecated используйте verifyWebProductPayment */
export async function verifyWebReportPayment(sessionId: string): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; message: string }
> {
  return verifyWebProductPayment(sessionId, 'full_report');
}

/** Возврат с Робокассы: OutSum+InvId или ?robokassa=success&sessionId=… */
export async function recoverRobokassaPaymentFromUrl(): Promise<RobokassaPaymentRecovery | null> {
  const invId = peekRobokassaReturnInvId();
  const sessionId = peekRobokassaReturnSessionId();
  const product = peekRobokassaReturnProduct();
  if (!invId && !sessionId) return null;

  const delaysMs = [0, 500, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
  let waited = 0;
  for (let i = 0; i < delaysMs.length; i++) {
    const waitMore = delaysMs[i] - waited;
    if (waitMore > 0) {
      await new Promise((r) => setTimeout(r, waitMore));
      waited = delaysMs[i];
    }
    if (invId) {
      const byInv = await verifyWebPaymentByInvId(invId);
      if (byInv.ok) {
        clearRobokassaReturnSession();
        stripPaymentQueryFromUrl();
        return { sessionId: byInv.sessionId, product: byInv.product };
      }
    }
    if (sessionId) {
      const verified = await verifyWebProductPayment(sessionId, product);
      if (verified.ok) {
        clearRobokassaReturnSession();
        stripPaymentQueryFromUrl();
        return { sessionId: verified.sessionId, product };
      }
    }
  }

  return null;
}
