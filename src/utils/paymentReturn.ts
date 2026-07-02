import {
  isReportUnlockProduct,
  parsePaymentProduct,
  type TelegramInvoiceProduct,
} from './paymentProductTypes';

const PAYMENT_FAIL_NOTICE_KEY = 'alz_payment_fail_notice';
const PAYMENT_FAIL_BOOT_KEY = 'alz_payment_fail_boot_result';
const ROBOKASSA_RETURN_SESSION_KEY = 'alz_robokassa_return_session';
const ROBOKASSA_RETURN_PRODUCT_KEY = 'alz_robokassa_return_product';
const ROBOKASSA_RETURN_INV_KEY = 'alz_robokassa_return_inv';
const ROBOKASSA_RETURN_PROOF_KEY = 'alz_robokassa_return_proof';
const ROBOKASSA_PENDING_PRODUCT_KEY = 'alz_robokassa_pending_product';

function parseRobokassaProduct(raw: string | null | undefined): TelegramInvoiceProduct | null {
  return parsePaymentProduct(raw);
}

export function isReportOfferProduct(product: TelegramInvoiceProduct): boolean {
  return isReportUnlockProduct(product);
}

const ROBOKASSA_PENDING_INV_LS_KEY = 'alz_robokassa_pending_inv';

/** Перед уходом на Робокассу — запомнить InvId для возврата без Shp_* в URL. */
export function rememberRobokassaPendingInvId(invId: number | string): void {
  if (typeof sessionStorage === 'undefined') return;
  const value = String(invId);
  try {
    sessionStorage.setItem(ROBOKASSA_RETURN_INV_KEY, value);
    localStorage.setItem(ROBOKASSA_PENDING_INV_LS_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Перед уходом на Робокассу — sessionId (если в Success URL нет Shp_*). */
export function rememberRobokassaPendingSessionId(sessionId: string): void {
  if (typeof sessionStorage === 'undefined' || !sessionId.trim()) return;
  try {
    sessionStorage.setItem(ROBOKASSA_RETURN_SESSION_KEY, sessionId.trim());
  } catch {
    /* ignore */
  }
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

    const invId = q.get('InvId')?.trim();
    if (invId) sessionStorage.setItem(ROBOKASSA_RETURN_INV_KEY, invId);

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

    const outSum = q.get('OutSum')?.trim();
    const signatureValue = q.get('SignatureValue')?.trim();
    if (outSum && invId && signatureValue) {
      const shp: Record<string, string> = {};
      q.forEach((v, k) => {
        if (k.startsWith('Shp_')) shp[k] = v;
      });
      sessionStorage.setItem(
        ROBOKASSA_RETURN_PROOF_KEY,
        JSON.stringify({ outSum, invId, signatureValue, shp }),
      );
    }

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

export function peekRobokassaReturnInvId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const fromUrl = q.get('InvId')?.trim();
    if (fromUrl) return fromUrl;
    const fromSession = sessionStorage.getItem(ROBOKASSA_RETURN_INV_KEY)?.trim();
    if (fromSession) return fromSession;
    return localStorage.getItem(ROBOKASSA_PENDING_INV_LS_KEY)?.trim() || null;
  } catch {
    return null;
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

/** Доказательство оплаты с Success URL Робокассы (OutSum + InvId + SignatureValue). */
export function peekRobokassaReturnProof(): {
  outSum: string;
  invId: string;
  signatureValue: string;
  shp: Record<string, string>;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const outSum = q.get('OutSum')?.trim();
    const invId = q.get('InvId')?.trim();
    const signatureValue = q.get('SignatureValue')?.trim();
    if (outSum && invId && signatureValue) {
      const shp: Record<string, string> = {};
      q.forEach((v, k) => {
        if (k.startsWith('Shp_')) shp[k] = v;
      });
      return { outSum, invId, signatureValue, shp };
    }
    const raw = sessionStorage.getItem(ROBOKASSA_RETURN_PROOF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      outSum?: string;
      invId?: string;
      signatureValue?: string;
      shp?: Record<string, string>;
    };
    if (parsed.outSum && parsed.invId && parsed.signatureValue) {
      return {
        outSum: parsed.outSum,
        invId: parsed.invId,
        signatureValue: parsed.signatureValue,
        shp: parsed.shp ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearRobokassaReturnSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(ROBOKASSA_RETURN_SESSION_KEY);
    sessionStorage.removeItem(ROBOKASSA_RETURN_PRODUCT_KEY);
    sessionStorage.removeItem(ROBOKASSA_RETURN_INV_KEY);
    sessionStorage.removeItem(ROBOKASSA_PENDING_PRODUCT_KEY);
    sessionStorage.removeItem(ROBOKASSA_RETURN_PROOF_KEY);
    localStorage.removeItem(ROBOKASSA_PENDING_INV_LS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingRobokassaReturn(): boolean {
  return Boolean(peekRobokassaReturnSessionId() || peekRobokassaReturnInvId());
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
    sessionStorage.removeItem(ROBOKASSA_RETURN_INV_KEY);
    sessionStorage.removeItem(ROBOKASSA_RETURN_PROOF_KEY);
    sessionStorage.removeItem(ROBOKASSA_PENDING_PRODUCT_KEY);
    localStorage.removeItem(ROBOKASSA_PENDING_INV_LS_KEY);
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
