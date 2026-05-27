import { PAYMENT_PRODUCTS } from './paymentProducts';
import { arePaymentsActive, isDevPaymentBypass, isPaymentsEnabled } from './paymentStub';

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
        | 'no_open_link'
        | 'payments_disabled';
    }
  | { status: 'error'; message: string };

export const prodamusPendingOrderKey = (sessionId: string) => `prodamus_pending_${sessionId}`;

const PRODAMUS_PENDING_PREFIX = 'prodamus_pending_';

function findSessionIdForPendingOrder(orderId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(PRODAMUS_PENDING_PREFIX)) continue;
    if (sessionStorage.getItem(key) === orderId) {
      return key.slice(PRODAMUS_PENDING_PREFIX.length);
    }
  }
  return null;
}

const invoiceOrderStorageKey = (sessionId: string) => `invoice_order_${sessionId}`;

function rememberInvoiceOrder(sessionId: string, orderId: string) {
  sessionStorage.setItem(prodamusPendingOrderKey(sessionId), orderId);
  try {
    localStorage.setItem(invoiceOrderStorageKey(sessionId), orderId);
  } catch {
    /* ignore */
  }
}

function getRememberedOrderIds(sessionId: string): string[] {
  const ids = new Set<string>();
  const a = sessionStorage.getItem(prodamusPendingOrderKey(sessionId));
  const b = localStorage.getItem(invoiceOrderStorageKey(sessionId));
  if (a) ids.add(a);
  if (b) ids.add(b);
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('prodamus_pending_')) {
      const v = sessionStorage.getItem(key);
      if (v) ids.add(v);
    }
  }
  return [...ids];
}

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

/** Задан URL бэкенда и оплата не выключена на сборке (VITE_PAYMENTS_ENABLED). */
export const isPaymentsBackendConfigured = (serverPaymentsReady = false): boolean =>
  arePaymentsActive(serverPaymentsReady) && Boolean(getPaymentsApiUrl());

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
      const data = (await res.json()) as PaidOrderPayload;
      if (res.ok && data.paid === true && data.sessionId === sessionId && applyPaidOrder(data)) {
        sessionStorage.removeItem(prodamusPendingOrderKey(sessionId));
        return true;
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
    alreadyPaid?: boolean;
    sessionId?: string;
    product?: string;
    error?: string;
    paymentsDisabled?: boolean;
  };

  let invoiceUrl: string | undefined;
  let paymentUrl: string | undefined;
  let orderId: string | undefined;
  let fetchTimeout = 0;

  try {
    const controller = new AbortController();
    fetchTimeout = window.setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(`${apiUrl}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, product, sessionId }),
      signal: controller.signal,
    });
    window.clearTimeout(fetchTimeout);
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
      if (data.paymentsDisabled || res.status === 503) {
        return { status: 'skipped', reason: 'payments_disabled' };
      }
      return { status: 'error', message: data.error || `HTTP ${res.status}` };
    }
    if (data.alreadyPaid && data.sessionId) {
      applyPaidOrder({ paid: true, product: data.product ?? product, sessionId: data.sessionId });
      return { status: 'paid' };
    }
    paymentUrl = data.paymentUrl;
    orderId = data.orderId;
    invoiceUrl = data.invoiceUrl;
    if (!paymentUrl && !invoiceUrl) {
      return { status: 'error', message: 'Сервер не вернул ссылку на оплату' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.name === 'AbortError') {
      return { status: 'error', message: 'Сервер оплаты не ответил. Проверьте интернет и нажмите «Оплатить» ещё раз.' };
    }
    if (/did not match the expected pattern/i.test(msg)) {
      return {
        status: 'error',
        message:
          'Неверный адрес API. Пересоберите проект в Amvera с VITE_TELEGRAM_PAYMENTS_URL=https://corta-ns-1234dinara.amvera.io',
      };
    }
    return { status: 'error', message: msg };
  } finally {
    if (fetchTimeout) window.clearTimeout(fetchTimeout);
  }

  if (paymentUrl && orderId) {
    rememberInvoiceOrder(sessionId, orderId);
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
      message: PAYMENT_PRODUCTS[product].redirectOpenedMessage,
    };
  }

  if (!tg.openInvoice) {
    if (typeof tg.openLink === 'function') {
      try {
        tg.openLink(invoiceUrl!);
        return {
          status: 'redirected',
          orderId: '',
          message: PAYMENT_PRODUCTS[product].redirectOpenedMessage,
        };
      } catch {
        return { status: 'skipped', reason: 'no_open_invoice' };
      }
    }
    return { status: 'skipped', reason: 'no_open_invoice' };
  }

  try {
    tg.expand?.();
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    let settled = false;
    let sawHidden = false;

    const finish = (result: OpenInvoiceResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(visibilityUnlockTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve(result);
    };

    const hardTimeout = window.setTimeout(() => {
      finish({ status: 'failed', detail: 'invoice_timeout' });
    }, 180_000);

    let visibilityUnlockTimer = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sawHidden = true;
        return;
      }
      if (document.visibilityState !== 'visible' || !sawHidden || settled) return;
      visibilityUnlockTimer = window.setTimeout(() => {
        if (!settled) finish({ status: 'cancelled' });
      }, 2000);
    };
    document.addEventListener('visibilitychange', onVisibility);

    try {
      tg.openInvoice!(invoiceUrl!, (st: string) => {
        if (st === 'paid') {
          applyPaidOrder({ paid: true, product, sessionId });
          finish({ status: 'paid' });
        } else if (st === 'cancelled') finish({ status: 'cancelled' });
        else finish({ status: 'failed', detail: st || 'unknown' });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      finish({ status: 'error', message: msg });
    }
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
  if (!status) return false;
  if (status === 'cancel' || status === 'cancelled' || status === 'fail' || status === 'failed') {
    return false;
  }
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

async function confirmOrderPaid(orderId: string, sessionId: string): Promise<ProdamusPaymentRecovery | null> {
  const paid = await pollProdamusOrderPaidQuick(orderId, sessionId);
  if (!paid) return null;
  const data = await fetchPaidOrder(orderId, 'payment-order-status');
  return data ? applyPaidOrder(data) : null;
}

/** Ожидающий заказ — только опрос статуса (без «подтверждения» без вебхука). */
export async function recoverProdamusPaymentPending(): Promise<ProdamusPaymentRecovery | null> {
  if (typeof window === 'undefined') return null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith('prodamus_pending_')) continue;
    const sessionId = key.slice(PRODAMUS_PENDING_PREFIX.length);
    const orderId = sessionStorage.getItem(key);
    if (!orderId || !sessionId) continue;
    const recovery = await confirmOrderPaid(orderId, sessionId);
    if (recovery) return recovery;
  }
  return null;
}

/** Возврат с Payform по urlSuccess — опрос статуса после вебхука. */
export async function recoverProdamusPaymentFromUrl(): Promise<ProdamusPaymentRecovery | null> {
  const orderId = parsePaymentReturnOrderId();
  if (!orderId || !isPaymentReturnSuccess()) {
    if (orderId) stripPaymentReturnParamsFromUrl();
    return null;
  }

  const sid = findSessionIdForPendingOrder(orderId);
  if (!sid) {
    stripPaymentReturnParamsFromUrl();
    return null;
  }

  const recovery = await confirmOrderPaid(orderId, sid);
  stripPaymentReturnParamsFromUrl();
  return recovery;
}

/** Любая сессия с флагом report_paid_* в localStorage. */
export function findAnyReportPaidSessionIdInStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('report_paid_')) continue;
      if (localStorage.getItem(key) === '1') {
        return key.slice('report_paid_'.length);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * ID сессии, за которую оплачен отчёт: сначала preferred, иначе любая оплаченная.
 */
export function getPaidReportSessionId(preferredSessionId?: string | null): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (preferredSessionId && localStorage.getItem(reportPaidStorageKey(preferredSessionId)) === '1') {
      return preferredSessionId;
    }
  } catch {
    /* ignore */
  }
  return findAnyReportPaidSessionIdInStorage();
}

/** @deprecated Используйте getPaidReportSessionId */
export function findPaidReportSessionId(): string | null {
  return getPaidReportSessionId(loadLastSessionIdFromHistory());
}

function loadLastSessionIdFromHistory(): string | null {
  try {
    const raw = localStorage.getItem('alz_history_v1');
    if (!raw) return null;
    const history = JSON.parse(raw) as { id: string }[];
    return history[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Доступ к отчёту именно для этой сессии (одна оплата = одно прохождение теста).
 */
export const isReportPaidUnlocked = (sessionId: string, serverPaymentsReady = false): boolean => {
  if (isDevPaymentBypass()) return true;
  if (!arePaymentsActive(serverPaymentsReady)) return true;
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
  } catch {
    return false;
  }
};

/** Есть ли оплаченный отчёт за любое прохождение (восстановление / «Я уже оплатил»). */
export const hasAnyPaidReportInStorage = (): boolean =>
  findAnyReportPaidSessionIdInStorage() != null;

/** Быстрая проверка оплаты Prodamus (только для своей sessionId). */
async function confirmReportPaymentFast(sessionId: string): Promise<boolean> {
  for (const orderId of getRememberedOrderIds(sessionId)) {
    for (let i = 0; i < 6; i++) {
      const data = await fetchPaidOrder(orderId, 'payment-order-status');
      if (data?.paid && data.sessionId === sessionId && applyPaidOrder(data)) return true;
      if (i < 5) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

function isReportPaidInStorage(sessionId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
  } catch {
    return false;
  }
}

const VERIFY_PAYMENT_FAIL_MSG =
  'Оплату не нашли по вашему аккаунту Telegram. Если деньги списались — напишите в поддержку: дата и @username.';

/**
 * «Проверить оплату» — только подтверждение на сервере (или Prodamus-заказ этой сессии).
 * Не доверяет чужим report_paid_* в localStorage и не открывает отчёт без реальной оплаты.
 */
export async function verifyReportPaymentOnServer(sessionId: string): Promise<RecoverReportResult> {
  if (isDevPaymentBypass()) return { ok: true, sessionId };

  const tg = window.Telegram?.WebApp;
  if (!tg?.initData) {
    return { ok: false, message: 'Откройте Corta из Telegram (кнопка у бота), не во внешнем браузере.' };
  }

  const base = getPaymentsApiUrl();
  if (!base) {
    return { ok: false, message: 'Сервер оплаты не настроен. Обновите приложение позже.' };
  }

  try {
    const res = await fetch(`${trimApi(base)}/payment-recover-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, sessionId, product: 'full_report' }),
    });
    const data = (await res.json()) as PaidOrderPayload;
    if (res.ok && data.paid === true && data.sessionId) {
      applyPaidOrder(data);
      return { ok: true, sessionId: data.sessionId };
    }
    if (res.status === 404) {
      return {
        ok: false,
        message: 'Сервер ещё без обновления. Обновите Corta и повторите через минуту.',
      };
    }
  } catch {
    return { ok: false, message: 'Нет связи с сервером. Проверьте интернет и повторите.' };
  }

  if (await confirmReportPaymentFast(sessionId)) {
    return { ok: true, sessionId };
  }

  try {
    localStorage.removeItem(reportPaidStorageKey(sessionId));
  } catch {
    /* ignore */
  }

  return { ok: false, message: VERIFY_PAYMENT_FAIL_MSG };
}

export type RecoverReportResult =
  | { ok: true; sessionId: string }
  | { ok: false; message: string };

function unlockReportSession(sessionId: string): RecoverReportResult {
  localStorage.setItem(reportPaidStorageKey(sessionId), '1');
  return { ok: true, sessionId };
}

/** Восстановить доступ к отчёту (Telegram + ЮKassa или Prodamus). */
export async function recoverFullReportAccess(sessionId: string): Promise<RecoverReportResult> {
  if (isReportPaidInStorage(sessionId)) {
    return { ok: true, sessionId };
  }

  const tg = window.Telegram?.WebApp;
  if (!tg?.initData) {
    return { ok: false, message: 'Откройте Corta из Telegram (кнопка у бота), не во внешнем браузере.' };
  }

  const fromUrl = await recoverProdamusPaymentFromUrl();
  if (fromUrl?.product === 'full_report' && fromUrl.sessionId) {
    return unlockReportSession(fromUrl.sessionId);
  }

  const base = getPaymentsApiUrl();
  if (base) {
    try {
      const res = await fetch(`${trimApi(base)}/payment-recover-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, sessionId, product: 'full_report' }),
      });
      const data = (await res.json()) as PaidOrderPayload;
      if (res.ok && data.paid && data.sessionId && applyPaidOrder(data)) {
        return { ok: true, sessionId: data.sessionId };
      }
      if (res.status === 404) {
        return {
          ok: false,
          message: 'Сервер ещё без обновления. Обновите Corta и повторите через минуту.',
        };
      }
    } catch {
      return { ok: false, message: 'Нет связи с сервером. Проверьте интернет и повторите.' };
    }

    if (await confirmReportPaymentFast(sessionId)) return { ok: true, sessionId };
  }

  return {
    ok: false,
    message:
      'Оплату пока не видим по этому аккаунту. Если списание было — напишите в поддержку: дата, @username, что проходили тест дважды.',
  };
}

/** Не платить повторно: проверка на сервере + ожидающий заказ + localStorage. */
export async function tryRecoverReportAccess(sessionId: string): Promise<boolean> {
  const r = await recoverFullReportAccess(sessionId);
  return r.ok;
};
