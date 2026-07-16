import type { TelegramInvoiceProduct } from './paymentProductTypes';
import { isReportUnlockProduct } from './paymentProductTypes';
import { isInAppBrowser } from './pwaInstall';
import {
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
  rememberRobokassaPendingSessionId,
} from './paymentReturn';
import { stripPaymentQueryFromUrl } from './appReload';
import {
  clearSubscriptionAccess,
  isSubscriptionActiveLocal,
  setSubscriptionFromServer,
} from './subscriptionAccess';

export type WebPaymentResult =
  | { status: 'already_paid' }
  | { status: 'redirected'; paymentUrl: string; external?: boolean }
  | { status: 'manual_open'; paymentUrl: string; message: string }
  | { status: 'pending_setup'; message: string }
  | { status: 'error'; message: string };

export type RobokassaPaymentRecovery = {
  sessionId: string;
  product: TelegramInvoiceProduct;
};

const PENDING_PAYMENT_URL_KEY = 'corta_pending_payment_url';
const INVOICE_FETCH_TIMEOUT_MS = 20_000;

const trimApi = (url: string) => url.replace(/\/$/, '');

export function rememberPendingPaymentUrl(url: string): void {
  try {
    sessionStorage.setItem(PENDING_PAYMENT_URL_KEY, url);
  } catch {
    /* ignore */
  }
}

export function peekPendingPaymentUrl(): string | null {
  try {
    return sessionStorage.getItem(PENDING_PAYMENT_URL_KEY);
  } catch {
    return null;
  }
}

/** Открыть Робокассу: во внешнем браузере в in-app WebView, иначе переход в этой вкладке. */
export function openPaymentUrl(url: string): 'external' | 'same_tab' | 'blocked' {
  const tg = window.Telegram?.WebApp;
  if (typeof tg?.openLink === 'function') {
    try {
      tg.openLink(url);
      return 'external';
    } catch {
      /* fall through */
    }
  }

  if (isInAppBrowser()) {
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return 'external';
    } catch {
      /* fall through */
    }
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (popup) return 'external';
    return 'blocked';
  }

  window.location.assign(url);
  return 'same_tab';
}

/** Проверить подписку на сервере по email и обновить локальный кэш. */
export async function syncSubscriptionAccessFromServer(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return isSubscriptionActiveLocal();

  const api = getPaymentsApiUrl();
  if (!api) return isSubscriptionActiveLocal();

  try {
    const res = await fetch(`${trimApi(api)}/api/subscription-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    });
    const data = (await res.json()) as { active?: boolean; endDate?: string | null };
    if (res.ok) {
      if (data.active && data.endDate) {
        setSubscriptionFromServer(data.endDate);
        return true;
      }
      clearSubscriptionAccess();
      return false;
    }
    return isSubscriptionActiveLocal();
  } catch {
    return isSubscriptionActiveLocal();
  }
}

function markWebProductPaid(
  sessionId: string,
  product: TelegramInvoiceProduct,
  subscriptionUntil?: string,
): void {
  localStorage.setItem(reportPaidStorageKey(sessionId), '1');
  if (subscriptionUntil) setSubscriptionFromServer(subscriptionUntil);
}

export async function openWebPayment(
  product: TelegramInvoiceProduct,
  sessionId: string,
  payerEmail?: string,
): Promise<WebPaymentResult> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { status: 'error', message: 'Сервер оплаты не настроен.' };
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), INVOICE_FETCH_TIMEOUT_MS);
    const res = await fetch(`${trimApi(api)}/invoice-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        product,
        email: payerEmail?.trim().toLowerCase() || undefined,
      }),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeout));
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
      rememberRobokassaPendingSessionId(sessionId);
      rememberRobokassaPendingProduct(product);
      if (data.invId != null) rememberRobokassaPendingInvId(data.invId);
      rememberPendingPaymentUrl(data.paymentUrl);
      const opened = openPaymentUrl(data.paymentUrl);
      if (opened === 'blocked') {
        return {
          status: 'manual_open',
          paymentUrl: data.paymentUrl,
          message:
            'Браузер Instagram не открыл оплату автоматически. Нажмите кнопку ниже — откроется Робокасса.',
        };
      }
      return {
        status: 'redirected',
        paymentUrl: data.paymentUrl,
        external: opened === 'external',
      };
    }
    return { status: 'error', message: 'Сервер не вернул ссылку на оплату.' };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        status: 'error',
        message: 'Сервер оплаты не ответил вовремя. Проверьте интернет и нажмите «Оплатить» ещё раз.',
      };
    }
    return { status: 'error', message: e instanceof Error ? e.message : 'Нет связи с сервером.' };
  }
}

export async function verifyWebProductPayment(
  sessionId: string,
  product: TelegramInvoiceProduct,
  payerEmail?: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  const api = getPaymentsApiUrl();
  if (!api) {
    return { ok: false, message: 'Сервер оплаты не настроен.' };
  }

  const proof = peekRobokassaReturnProof();
  const invId = proof ? peekRobokassaReturnInvId() : undefined;

  try {
    const res = await fetch(`${trimApi(api)}/payment-recover-session-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        product,
        email: payerEmail?.trim().toLowerCase() || undefined,
        invId: invId ?? undefined,
      }),
    });
    const data = (await res.json()) as {
      paid?: boolean;
      sessionId?: string;
      subscriptionUntil?: string;
    };
    if (res.ok && data.paid && data.sessionId) {
      markWebProductPaid(data.sessionId, product, data.subscriptionUntil);
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
      subscriptionUntil?: string;
    };
    if (res.ok && data.paid && data.sessionId && data.product) {
      markWebProductPaid(data.sessionId, data.product, data.subscriptionUntil);
      return { ok: true, sessionId: data.sessionId, product: data.product };
    }
  } catch {
    /* ignore */
  }
  return { ok: false };
}

/** @deprecated используйте verifyWebProductPayment */
export async function verifyWebReportPayment(
  sessionId: string,
  payerEmail?: string,
): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; message: string }
> {
  return verifyWebProductPayment(sessionId, 'full_report', payerEmail);
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
