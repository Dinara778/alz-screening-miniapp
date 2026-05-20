export type TelegramInvoiceProduct = 'full_report' | 'consultation';

export type OpenInvoiceResult =
  | { status: 'paid' }
  | { status: 'cancelled' }
  | { status: 'failed'; detail: string }
  | {
      status: 'redirected';
      orderId: string;
      message: string;
    }
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

export const prodamusPendingOrderKey = (sessionId: string) => `prodamus_pending_${sessionId}`;

const trimApi = (url: string) => url.replace(/\/$/, '');

function stripEnvQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Абсолютный HTTPS-URL API; без схемы Safari даёт «did not match the expected pattern». */
function resolvePaymentsApiUrl(raw: string): string | null {
  const trimmed = stripEnvQuotes(raw);
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return trimApi(u.origin);
  } catch {
    return null;
  }
}

/** URL бэкенда оплат: тот же домен, что мини-приложение, или VITE_TELEGRAM_PAYMENTS_URL при сборке. */
export function getPaymentsApiUrl(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const origin = new URL(window.location.href).origin;
      if (/^https?:\/\//i.test(origin)) return trimApi(origin);
    } catch {
      /* ignore */
    }
  }

  const envRaw = stripEnvQuotes(
    (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined) ?? '',
  );
  return envRaw ? resolvePaymentsApiUrl(envRaw) : null;
}

function resolvePaymentLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/** Задан URL бэкенда счетов (POST /invoice). Если нет — оплата недоступна. */
export const isPaymentsBackendConfigured = (): boolean => Boolean(getPaymentsApiUrl());

/** Mini App открыт в Telegram и есть initData (не просто браузер). */
export const isTelegramMiniApp = (): boolean => {
  const tg = window.Telegram?.WebApp;
  return Boolean(tg?.initData && tg?.version);
};

export const reportPaidStorageKey = (sessionId: string) => `report_paid_${sessionId}`;

export const consultationPaidStorageKey = (sessionId: string) => `consultation_paid_${sessionId}`;

type PaidOrderPayload = { paid?: boolean; product?: string; sessionId?: string };

function applyPaidOrder(data: PaidOrderPayload): ProdamusPaymentRecovery | null {
  if (!data.paid || !data.sessionId) return null;
  sessionStorage.removeItem(prodamusPendingOrderKey(data.sessionId));
  if (data.product === 'full_report') {
    localStorage.setItem(reportPaidStorageKey(data.sessionId), '1');
    return { paid: true, product: 'full_report', sessionId: data.sessionId };
  }
  if (data.product === 'consultation') {
    localStorage.setItem(consultationPaidStorageKey(data.sessionId), '1');
    window.dispatchEvent(new CustomEvent('consultation-paid'));
    return { paid: true, product: 'consultation', sessionId: data.sessionId };
  }
  return null;
}

async function fetchPaidOrder(
  orderId: string,
  endpoint: 'payment-order-status' | 'payment-return-confirm',
): Promise<PaidOrderPayload | null> {
  const tg = window.Telegram?.WebApp;
  const base = getPaymentsApiUrl();
  if (!tg?.initData || !base) return null;
  try {
    const res = await fetch(`${trimApi(base)}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId }),
    });
    return (await res.json()) as PaidOrderPayload;
  } catch {
    return null;
  }
}

export type ProdamusPaymentRecovery = {
  paid: true;
  product: 'full_report' | 'consultation';
  sessionId: string;
};

const POLL_INTERVAL_MS = 2000;
const POLL_QUICK_MS = 45_000;

/** Короткий опрос после возврата в Mini App (основной сценарий — URL ?prodamus_order=). */
export async function pollProdamusOrderPaidQuick(
  orderId: string,
  sessionId: string,
): Promise<boolean> {
  const tg = window.Telegram?.WebApp;
  const apiUrl = getPaymentsApiUrl();
  if (!tg?.initData || !apiUrl) return false;

  const deadline = Date.now() + POLL_QUICK_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${trimApi(apiUrl)}/payment-order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, orderId }),
      });
      let data = (await res.json()) as { paid?: boolean; sessionId?: string };
      if (res.ok && data.paid === true && data.sessionId === sessionId) {
        sessionStorage.removeItem(prodamusPendingOrderKey(sessionId));
        return true;
      }
      if (!data.paid) {
        data = (await fetchPaidOrder(orderId, 'payment-return-confirm')) ?? data;
        if (data.paid && data.sessionId === sessionId) {
          applyPaidOrder(data);
          return true;
        }
      }
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
  const apiUrl = getPaymentsApiUrl();

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
    const res = await fetch(`${apiUrl}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, product, sessionId }),
    });
    const raw = await res.text();
    let data: InvoiceResponse = {};
    try {
      data = raw ? (JSON.parse(raw) as InvoiceResponse) : {};
    } catch {
      if (res.status === 405) {
        return {
          status: 'error',
          message:
            'На домене нет API оплаты (только статика). В Amvera: сборка Docker + Dockerfile, SERVE_STATIC=true, затем пересоберите.',
        };
      }
      return {
        status: 'error',
        message: `Сервер вернул ${res.status}. Проверьте деплой Node API (не static_web).`,
      };
    }
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
    const msg = e instanceof Error ? e.message : String(e);
    if (/did not match the expected pattern/i.test(msg)) {
      return {
        status: 'error',
        message:
          'Неверный адрес API. Пересоберите проект в Amvera с VITE_TELEGRAM_PAYMENTS_URL=https://corta-ns-1234dinara.amvera.io',
      };
    }
    return { status: 'error', message: msg };
  }

  if (paymentUrl && orderId) {
    if (typeof tg.openLink !== 'function') {
      return { status: 'skipped', reason: 'no_open_link' };
    }
    const link = resolvePaymentLink(paymentUrl);
    if (!link) {
      return { status: 'error', message: 'Сервер вернул некорректную ссылку на оплату. Проверьте TELEGRAM_MINI_APP_URL на сервере.' };
    }
    try {
      tg.openLink(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 'error', message: msg };
    }
    return {
      status: 'redirected',
      orderId,
      message:
        'Открыли безопасную оплату. После оплаты закройте её и вернитесь в Corta в Telegram — доступ откроется автоматически.',
    };
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

export function parsePaymentReturnOrderId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('prodamus_order') || params.get('order_id');
  return id?.trim() || null;
}

function isPaymentReturnSuccess(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (!parsePaymentReturnOrderId()) return false;
  const status = (params.get('prodamus_status') || params.get('payment_status') || '').toLowerCase();
  if (!status) return true;
  return status === 'ok' || status === 'success' || status === 'paid';
}

function stripPaymentReturnParamsFromUrl(): void {
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('prodamus_order');
    u.searchParams.delete('prodamus_status');
    u.searchParams.delete('order_id');
    u.searchParams.delete('payment_status');
    const qs = u.searchParams.toString();
    const path = u.pathname + (qs ? `?${qs}` : '') + u.hash;
    window.history.replaceState({}, '', path);
  } catch {
    /* ignore */
  }
}

async function confirmOrderPaid(orderId: string): Promise<ProdamusPaymentRecovery | null> {
  let data = await fetchPaidOrder(orderId, 'payment-return-confirm');
  let recovery = data ? applyPaidOrder(data) : null;
  if (recovery) return recovery;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    data = await fetchPaidOrder(orderId, 'payment-order-status');
    recovery = data ? applyPaidOrder(data) : null;
    if (recovery) return recovery;
  }
  return null;
}

/** Ожидающий заказ в sessionStorage (если вернулись в бот без параметров в URL). */
export async function recoverProdamusPaymentPending(): Promise<ProdamusPaymentRecovery | null> {
  if (typeof window === 'undefined') return null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith('prodamus_pending_')) continue;
    const orderId = sessionStorage.getItem(key);
    if (!orderId) continue;
    const recovery = await confirmOrderPaid(orderId);
    if (recovery) return recovery;
  }
  return null;
}

/** Возврат с Payform: подтверждение заказа и разблокировка отчёта. */
export async function recoverProdamusPaymentFromUrl(): Promise<ProdamusPaymentRecovery | null> {
  const orderId = parsePaymentReturnOrderId();
  let recovery: ProdamusPaymentRecovery | null = null;

  if (orderId && isPaymentReturnSuccess()) {
    recovery = await confirmOrderPaid(orderId);
    stripPaymentReturnParamsFromUrl();
    if (recovery) return recovery;
  }

  recovery = await recoverProdamusPaymentPending();
  return recovery;
}

/** Последнее прохождение в истории, за которое оплачен отчёт. */
export function findPaidReportSessionId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('alz_history_v1');
    if (!raw) return null;
    const history = JSON.parse(raw) as { id: string }[];
    const newest = history[0]?.id;
    if (newest && localStorage.getItem(reportPaidStorageKey(newest)) === '1') {
      return newest;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Доступ к полному отчёту: оплачено в localStorage или временный обход (VITE_DEV_BYPASS_REPORT_PAYMENT).
 * Без успешной оплаты отчёт не открывается (для теста без оплаты задайте только VITE_DEV_BYPASS_REPORT_PAYMENT).
 */
export const isReportPaidUnlocked = (sessionId: string): boolean => {
  if (import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true') return true;
  return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
};
