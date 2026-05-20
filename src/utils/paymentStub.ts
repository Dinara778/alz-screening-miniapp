/**
 * Реальная оплата включена, если не выключено явно.
 * На Amvera: VITE_PAYMENTS_ENABLED=false в сборке, чтобы CTA не открывали Payform.
 */
export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Только локальная разработка: VITE_DEV_BYPASS_REPORT_PAYMENT=true */
export const isDevPaymentBypass = (): boolean =>
  import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

/** Пропустить счёт и сразу открыть отчёт — только dev-флаг, не «забыли VITE_PAYMENTS_ENABLED». */
export const shouldBypassReportPayment = (): boolean => isDevPaymentBypass();
