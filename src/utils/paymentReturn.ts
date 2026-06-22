const PAYMENT_FAIL_NOTICE_KEY = 'alz_payment_fail_notice';
const PAYMENT_FAIL_BOOT_KEY = 'alz_payment_fail_boot_result';

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
