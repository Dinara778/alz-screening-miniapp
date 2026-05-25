/**
 * Реальная оплата (отчёт 199 ₽ и сессия 5 490 ₽).
 * VITE_PAYMENTS_ENABLED=false на сборке — «бесплатный отчёт» по умолчанию,
 * но если сервер (/health → payments.ready) настроен с ЮKassa, оплата включается.
 */

/** QA: true — отчёт без оплаты. Прод: false (оплата через Telegram + ЮKassa). */
const TEMPORARY_BYPASS_REPORT_PAYMENT = false;

export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Dev-обход или TEMPORARY_BYPASS_REPORT_PAYMENT выше */
export const isDevPaymentBypass = (): boolean =>
  TEMPORARY_BYPASS_REPORT_PAYMENT || import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

/** Оплата активна: в сборке или сервер сообщил payments.ready. */
export const arePaymentsActive = (serverPaymentsReady = false): boolean =>
  isPaymentsEnabled() || serverPaymentsReady;

/** Расширенный отчёт без оплаты только при dev-обходе или когда оплата реально выключена. */
export const shouldBypassReportPayment = (serverPaymentsReady = false): boolean =>
  isDevPaymentBypass() || !arePaymentsActive(serverPaymentsReady);
