const HARD_RELOAD_KEY = 'alz_hard_reload';
const RESTART_KEY = 'alz_restart';

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
  ];
  let changed = false;
  for (const key of drop) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
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

export function reloadApplication(): void {
  markHardReload();
  window.location.reload();
}

export function restartApplicationToIntro(): void {
  markRestartIntent();
  stripPaymentQueryFromUrl();
  try {
    sessionStorage.removeItem('alz_result_ui_v1');
    sessionStorage.removeItem('alz_report_ui_v1');
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.search = '';
  const target = url.pathname + url.hash;
  if (`${window.location.pathname}${window.location.hash}` !== target) {
    window.location.replace(target);
  }
  window.location.reload();
}
