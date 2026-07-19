import { clearRobokassaReturnSession } from './paymentReturn';

const HARD_RELOAD_KEY = 'alz_hard_reload';
const RESTART_KEY = 'alz_restart';
const PROGRESS_KEY = 'alz_progress_v1';
const PAYMENT_FAIL_NOTICE_KEY = 'alz_payment_fail_notice';
const PAYMENT_FAIL_BOOT_KEY = 'alz_payment_fail_boot_result';
const ROBOKASSA_PENDING_INV_LS_KEY = 'alz_robokassa_pending_inv';

/** Убрать параметры возврата с оплаты из адреса (чтобы не зацикливать recovery). */
export function stripPaymentQueryFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const drop = [
    'prodamus_order',
    'order_id',
    'prodamus_status',
    'payment_status',
    'payment',
    'status',
    'r',
    'boot',
    'robokassa',
    'sessionId',
    'product',
    'OutSum',
    'InvId',
    'SignatureValue',
  ];
  let changed = false;
  for (const key of drop) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  url.searchParams.forEach((_, key) => {
    if (key.startsWith('Shp_')) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, '', next);
}

export function markHardReload(): void {
  try {
    sessionStorage.setItem(HARD_RELOAD_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeHardReloadFlag(): boolean {
  try {
    if (sessionStorage.getItem(HARD_RELOAD_KEY) === '1') {
      sessionStorage.removeItem(HARD_RELOAD_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function markRestartIntent(): void {
  try {
    sessionStorage.setItem(RESTART_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeRestartIntent(): boolean {
  try {
    if (sessionStorage.getItem(RESTART_KEY) === '1') {
      sessionStorage.removeItem(RESTART_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function clearTransientUiKeys(): void {
  try {
    sessionStorage.removeItem('alz_result_ui_v1');
    sessionStorage.removeItem('alz_report_ui_v1');
  } catch {
    /* ignore */
  }
}

/** Сброс навигации и переход на intro (полная перезагрузка WebView). */
export function goToIntroFresh(): void {
  markRestartIntent();
  stripPaymentQueryFromUrl();
  clearTransientUiKeys();
  clearRobokassaReturnSession();
  try {
    sessionStorage.removeItem(PAYMENT_FAIL_NOTICE_KEY);
    sessionStorage.removeItem(PAYMENT_FAIL_BOOT_KEY);
    localStorage.removeItem(ROBOKASSA_PENDING_INV_LS_KEY);
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
  const base = window.location.pathname + (window.location.hash || '');
  window.location.replace(`${base}?r=${Date.now()}`);
}

export function reloadApplication(): void {
  goToIntroFresh();
}

export function restartApplicationToIntro(): void {
  goToIntroFresh();
}
