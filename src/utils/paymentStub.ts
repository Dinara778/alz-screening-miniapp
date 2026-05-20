/** Сообщение, пока оплата не подключена (Prodamus / счета). */
export const PAYMENT_STUB_MESSAGE =
  'Оплата скоро будет доступна. По вопросам напишите на hello@bookvolon.ru или в техподдержку в Telegram.';

/**
 * Реальная оплата включена, если не выключено явно.
 * На Amvera в Dockerfile по умолчанию true; локально можно VITE_PAYMENTS_ENABLED=false.
 */
export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Заглушка только для явного dev-обхода — не из-за отсутствия переменной при сборке. */
export const isPaymentsStubbed = (): boolean => isDevPaymentBypass();

/** Только локальная разработка: VITE_DEV_BYPASS_REPORT_PAYMENT=true */
export const isDevPaymentBypass = (): boolean =>
  import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

/** Пропустить счёт и сразу открыть отчёт — только dev-флаг, не «забыли VITE_PAYMENTS_ENABLED». */
export const shouldBypassReportPayment = (): boolean => isDevPaymentBypass();
