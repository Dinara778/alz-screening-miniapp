import type { TelegramInvoiceProduct } from './telegramPayments';

const PAYMENT_FAIL_NOTICE_KEY = 'alz_payment_fail_notice';
const PAYMENT_FAIL_BOOT_KEY = 'alz_payment_fail_boot_result';
const ROBOKASSA_RETURN_SESSION_KEY = 'alz_robokassa_return_session';
const ROBOKASSA_RETURN_PRODUCT_KEY = 'alz_robokassa_return_product';
const ROBOKASSA_PENDING_PRODUCT_KEY = 'alz_robokassa_pending_product';

function parseRobokassaProduct(raw: string | null | undefined): TelegramInvoiceProduct | null {
  if (raw === 'full_report' || raw === 'consultation') return raw;
  return null;
}

/** Перед уходом на Робокассу — запомнить product (на случай старого Success URL без product). */
export function rememberRobokassaPendingProduct(product: TelegramInvoiceProduct): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(ROBOKASSA_PENDING_PRODUCT_KEY, product);
  } catch {
    /* ignore */
  }
}

/** Сохранить sessionId и product из URL возврата Робокассы до очистки query. */
export function captureRobokassaSuccessFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const isRobokassaSuccess =
      q.get('robokassa') === 'success' || Boolean(q.get('OutSum') && q.get('InvId'));
    if (!isRobokassaSuccess) return;

    const sessionId =
      q.get('sessionId')?.trim() ||
      q.get('Shp_sessionId')?.trim() ||
      q.get('Shp_sessionid')?.trim();
    if (sessionId) sessionStorage.setItem(ROBOKASSA_RETURN_SESSION_KEY, sessionId);

    const product =
      parseRobokassaProduct(q.get('product')) ??
      parseRobokassaProduct(q.get('Shp_product')) ??
      parseRobokassaProduct(q.get('Shp_Product')) ??
      parseRobokassaProduct(sessionStorage.getItem(ROBOKASSA_PENDING_PRODUCT_KEY));
    if (product) sessionStorage.setItem(ROBOKASSA_RETURN_PRODUCT_KEY, product);

    if (q.get('robokassa') !== 'success' && sessionId) {
      const next = new URLSearchParams(q);
      next.set('robokassa', 'success');
      if (!next.get('sessionId')) next.set('sessionId', sessionId);
      if (product && !next.get('product')) next.set('product', product);
      const path = `${window.location.pathname}?${next}${window.location.hash}`;
      window.history.replaceState({}, '', path);
    }
  } catch {
    /* ignore */
  }
}

/** sessionId возврата с Робокассы: из URL или из sessionStorage после capture. */
export function peekRobokassaReturnSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('robokassa') === 'success' || (q.get('OutSum') && q.get('InvId'))) {
      const fromUrl =
        q.get('sessionId')?.trim() ||
        q.get('Shp_sessionId')?.trim() ||
        q.get('Shp_sessionid')?.trim();
      if (fromUrl) return fromUrl;
    }
    return sessionStorage.getItem(ROBOKASSA_RETURN_SESSION_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function peekRobokassaReturnProduct(): TelegramInvoiceProduct {
  if (typeof window === 'undefined') return 'full_report';
  try {
    const q = new URLSearchParams(window.location.search);
    const fromUrl =
      parseRobokassaProduct(q.get('product')) ??
      parseRobokassaProduct(q.get('Shp_product')) ??
      parseRobokassaProduct(q.get('Shp_Product'));
    if (fromUrl) return fromUrl;
    const stored = parseRobokassaProduct(sessionStorage.getItem(ROBOKASSA_RETURN_PRODUCT_KEY));
    if (stored) return stored;
    const pending = parseRobokassaProduct(sessionStorage.getItem(ROBOKASSA_PENDING_PRODUCT_KEY));
    if (pending) return pending;
  } catch {
    /* ignore */
  }
  return 'full_report';
}

export function clearRobokassaReturnSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(ROBOKASSA_RETURN_SESSION_KEY);
    sessionStorage.removeItem(ROBOKASSA_RETURN_PRODUCT_KEY);
    sessionStorage.removeItem(ROBOKASSA_PENDING_PRODUCT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingRobokassaReturn(): boolean {
  return Boolean(peekRobokassaReturnSessionId());
}

/** Считать ?robokassa=fail до очистки URL (вызывать один раз при старте). */
export function capturePaymentFailFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const status = q.get('robokassa');
    if (status !== 'fail' && status !== 'cancel') return;
    sessionStorage.setItem(PAYMENT_FAIL_NOTICE_KEY, '1');
    sessionStorage.setItem(PAYMENT_FAIL_BOOT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldBootToResultAfterPaymentFail(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(PAYMENT_FAIL_BOOT_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumePaymentFailNotice(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    if (sessionStorage.getItem(PAYMENT_FAIL_NOTICE_KEY) !== '1') return false;
    sessionStorage.removeItem(PAYMENT_FAIL_NOTICE_KEY);
    sessionStorage.removeItem(PAYMENT_FAIL_BOOT_KEY);
    return true;
  } catch {
    return false;
  }
}

export const PAYMENT_FAIL_NOTICE_TEXT = 'Оплата не прошла, попробуйте снова';

export const CONSULTATION_PAID_THANKS_TEXT =
  'Спасибо за оплату! Мы свяжемся с вами в течение 15 минут!';
