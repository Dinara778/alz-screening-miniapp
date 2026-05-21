/**
 * Реальная оплата (отчёт 399 ₽ и сессия 5 490 ₽) включена, если не выключено явно.
 * На Amvera: VITE_PAYMENTS_ENABLED=false — Payform / Prodamus не открываются.
 */
export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Только локальная разработка: VITE_DEV_BYPASS_REPORT_PAYMENT=true */
export const isDevPaymentBypass = (): boolean =>
  import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

/** Расширенный отчёт без оплаты: dev-флаг или оплата выключена на сборке (Dockerfile: false). */
export const shouldBypassReportPayment = (): boolean =>
  isDevPaymentBypass() || !isPaymentsEnabled();
