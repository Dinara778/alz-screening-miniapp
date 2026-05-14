export type TelegramInvoiceProduct = 'full_report' | 'consultation';

export type OpenInvoiceResult =
  | { status: 'paid' }
  | { status: 'cancelled' }
  | { status: 'failed'; detail: string }
  | {
      status: 'skipped';
      reason:
        | 'not_telegram'
        | 'no_api_url'
        | 'no_init_data'
        | 'no_open_invoice'
        | 'no_open_link';
    }
  | { status: 'error'; message: string };

const trimApi = (url: string) => url.replace(/\/$/, '');

/** Задан URL бэкенда счетов (POST /invoice). Если нет — оплата недоступна. */
export const isPaymentsBackendConfigured = (): boolean => {
  return Boolean((import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim());
};

/** Mini App открыт в Telegram и есть initData (не просто браузер). */
export const isTelegramMiniApp = (): boolean => {
  const tg = window.Telegram?.WebApp;
  return Boolean(tg?.initData && tg?.version);
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

async function pollProdamusOrderPaid(
  apiUrl: string,
  initData: string,
  orderId: string,
): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${trimApi(apiUrl)}/payment-order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, orderId }),
      });
      const data = (await res.json()) as { paid?: boolean };
      if (res.ok && data.paid === true) return true;
    } catch {
      /* сеть */
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Запрашивает у бэкенда счёт: нативный Telegram (invoiceUrl) или ссылка Prodamus (paymentUrl + опрос статуса).
 */
export const openTelegramInvoiceForProduct = async (
  product: TelegramInvoiceProduct,
  sessionId: string,
): Promise<OpenInvoiceResult> => {
  const tg = window.Telegram?.WebApp;
  const apiUrl = (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim();

  if (!apiUrl) return { status: 'skipped', reason: 'no_api_url' };
  if (!tg?.initData) return { status: 'skipped', reason: 'no_init_data' };

  type InvoiceResponse = {
    invoiceUrl?: string;
    paymentUrl?: string;
    orderId?: string;
    error?: string;
  };

  let invoiceUrl: string | undefined;
  let paymentUrl: string | undefined;
  let orderId: string | undefined;

  try {
    const res = await fetch(`${trimApi(apiUrl)}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, product, sessionId }),
    });
    const data = (await res.json()) as InvoiceResponse;
    if (!res.ok) {
      return { status: 'error', message: data.error || `HTTP ${res.status}` };
    }
    paymentUrl = data.paymentUrl;
    orderId = data.orderId;
    invoiceUrl = data.invoiceUrl;
    if (!paymentUrl && !invoiceUrl) {
      return { status: 'error', message: 'Сервер не вернул ссылку на оплату' };
    }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  if (paymentUrl && orderId) {
    if (typeof tg.openLink !== 'function') {
      return { status: 'skipped', reason: 'no_open_link' };
    }
    tg.openLink(paymentUrl);
    const paid = await pollProdamusOrderPaid(trimApi(apiUrl), tg.initData, orderId);
    if (paid) return { status: 'paid' };
    return { status: 'failed', detail: 'prodamus_timeout' };
  }

  if (!tg.openInvoice) return { status: 'skipped', reason: 'no_open_invoice' };

  return new Promise((resolve) => {
    tg.openInvoice!(invoiceUrl!, (st: string) => {
      if (st === 'paid') resolve({ status: 'paid' });
      else if (st === 'cancelled') resolve({ status: 'cancelled' });
      else resolve({ status: 'failed', detail: st || 'unknown' });
    });
  });
};

export const reportPaidStorageKey = (sessionId: string) => `report_paid_${sessionId}`;

export const consultationPaidStorageKey = (sessionId: string) => `consultation_paid_${sessionId}`;

/**
 * После возврата с payform (urlSuccess) мини-приложение перезагружается — подтверждаем заказ по order_id в URL
 * и выставляем флаги доступа (сервер проверяет initData и факт оплаты по вебхуку).
 */
export async function recoverProdamusPaymentFromUrl(apiUrl: string): Promise<void> {
  const raw = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(raw);
  const orderId = params.get('prodamus_order');
  if (!orderId?.trim()) return;

  const tg = window.Telegram?.WebApp;
  const base = apiUrl.trim();
  if (!tg?.initData || !base) return;

  try {
    const res = await fetch(`${trimApi(base)}/payment-order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId }),
    });
    const data = (await res.json()) as { paid?: boolean; product?: string; sessionId?: string };
    if (res.ok && data.paid === true && data.sessionId) {
      if (data.product === 'full_report') {
        localStorage.setItem(reportPaidStorageKey(data.sessionId), '1');
      } else if (data.product === 'consultation') {
        localStorage.setItem(consultationPaidStorageKey(data.sessionId), '1');
        window.dispatchEvent(new CustomEvent('consultation-paid'));
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('prodamus_order');
    u.searchParams.delete('prodamus_status');
    const qs = u.searchParams.toString();
    const path = u.pathname + (qs ? `?${qs}` : '') + u.hash;
    window.history.replaceState({}, '', path);
  } catch {
    /* ignore */
  }
}

/**
 * Доступ к полному отчёту: оплачено в localStorage или временный обход (VITE_DEV_BYPASS_REPORT_PAYMENT).
 * Без успешной оплаты отчёт не открывается (для теста без оплаты задайте только VITE_DEV_BYPASS_REPORT_PAYMENT).
 */
export const isReportPaidUnlocked = (sessionId: string): boolean => {
  if (import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true') return true;
  return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
};
