/**
 * Реальная оплата (отчёт 199 ₽ и сессия 5 490 ₽).
 * VITE_PAYMENTS_ENABLED=false на сборке — «бесплатный отчёт» по умолчанию,
 * но если сервер (/health → payments.ready) настроен с ЮKassa, оплата включается.
 */
export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Только локальная разработка: VITE_DEV_BYPASS_REPORT_PAYMENT=true */
export const isDevPaymentBypass = (): boolean =>
  import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

/** Оплата активна: в сборке или сервер сообщил payments.ready. */
export const arePaymentsActive = (serverPaymentsReady = false): boolean =>
  isPaymentsEnabled() || serverPaymentsReady;

/** Расширенный отчёт без оплаты только при dev-обходе или когда оплата реально выключена. */
export const shouldBypassReportPayment = (serverPaymentsReady = false): boolean =>
  isDevPaymentBypass() || !arePaymentsActive(serverPaymentsReady);
