export type TelegramInvoiceProduct = 'full_report' | 'consultation';

export type OpenInvoiceResult =
  | { status: 'paid' }
  | { status: 'cancelled' }
  | { status: 'failed'; detail: string }
  | { status: 'skipped'; reason: 'not_telegram' | 'no_api_url' | 'no_init_data' | 'no_open_invoice' }
  | { status: 'error'; message: string };

const trimApi = (url: string) => url.replace(/\/$/, '');

/** Задан URL бэкенда счетов (POST /invoice). Если нет — нативная оплата Telegram недоступна. */
export const isPaymentsBackendConfigured = (): boolean => {
  return Boolean((import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim());
};

/** Mini App открыт в Telegram и есть initData (не просто браузер). */
export const isTelegramMiniApp = (): boolean => {
  const tg = window.Telegram?.WebApp;
  return Boolean(tg?.initData && tg?.version);
};

/**
 * Запрашивает у бэкенда ссылку на счёт и открывает нативную оплату Telegram.
 * Без VITE_TELEGRAM_PAYMENTS_URL или вне Telegram — вернёт skipped (полный отчёт без оплаты не открывается).
 */
export const openTelegramInvoiceForProduct = async (
  product: TelegramInvoiceProduct,
  sessionId: string,
): Promise<OpenInvoiceResult> => {
  const tg = window.Telegram?.WebApp;
  const apiUrl = (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim();

  if (!tg?.openInvoice) return { status: 'skipped', reason: 'no_open_invoice' };
  if (!apiUrl) return { status: 'skipped', reason: 'no_api_url' };
  if (!tg.initData) return { status: 'skipped', reason: 'no_init_data' };

  let invoiceUrl: string;
  try {
    const res = await fetch(`${trimApi(apiUrl)}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, product, sessionId }),
    });
    const data = (await res.json()) as { invoiceUrl?: string; error?: string };
    if (!res.ok) {
      return { status: 'error', message: data.error || `HTTP ${res.status}` };
    }
    if (!data.invoiceUrl) {
      return { status: 'error', message: 'Сервер не вернул invoiceUrl' };
    }
    invoiceUrl = data.invoiceUrl;
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  return new Promise((resolve) => {
    tg.openInvoice!(invoiceUrl, (st: string) => {
      if (st === 'paid') resolve({ status: 'paid' });
      else if (st === 'cancelled') resolve({ status: 'cancelled' });
      else resolve({ status: 'failed', detail: st || 'unknown' });
    });
  });
};

export const reportPaidStorageKey = (sessionId: string) => `report_paid_${sessionId}`;

/**
 * Доступ к полному отчёту: оплачено в localStorage, временный обход (VITE_DEV_BYPASS_REPORT_PAYMENT),
 * либо бэкенд оплаты не настроен — тогда отчёт открыт для проверки (на проде задайте VITE_TELEGRAM_PAYMENTS_URL).
 */
export const isReportPaidUnlocked = (sessionId: string): boolean => {
  if (import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true') return true;
  if (!isPaymentsBackendConfigured()) return true;
  return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
};
