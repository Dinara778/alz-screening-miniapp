const PAYMENT_FAIL_NOTICE_KEY = 'alz_payment_fail_notice';
const PAYMENT_FAIL_BOOT_KEY = 'alz_payment_fail_boot_result';
const ROBOKASSA_RETURN_SESSION_KEY = 'alz_robokassa_return_session';

/** Сохранить sessionId из ?robokassa=success до очистки URL. */
export function captureRobokassaSuccessFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('robokassa') !== 'success') return;
    const sessionId = q.get('sessionId')?.trim();
    if (sessionId) sessionStorage.setItem(ROBOKASSA_RETURN_SESSION_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

/** sessionId возврата с Робокассы: из URL или из sessionStorage после capture. */
export function peekRobokassaReturnSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('robokassa') === 'success') {
      const fromUrl = q.get('sessionId')?.trim();
      if (fromUrl) return fromUrl;
    }
    return sessionStorage.getItem(ROBOKASSA_RETURN_SESSION_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function clearRobokassaReturnSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(ROBOKASSA_RETURN_SESSION_KEY);
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
