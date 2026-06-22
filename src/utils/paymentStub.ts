/**
 * Реальная оплата (отчёт 199 ₽ и сессия 5 490 ₽).
 * VITE_PAYMENTS_ENABLED=false на сборке — в dev можно без оплаты;
 * на проде с API Amvera оплата включена, если сервер payments.ready или задан URL API.
 */

/** QA: true — отчёт без оплаты на всех сборках (временно). Вернуть false после проверки. */
const TEMPORARY_BYPASS_REPORT_PAYMENT = true;

export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';

/** Обход оплаты отчёта: QA-флаг или локально VITE_DEV_BYPASS_REPORT_PAYMENT=true */
export const isDevPaymentBypass = (): boolean =>
  TEMPORARY_BYPASS_REPORT_PAYMENT ||
  (!import.meta.env.PROD && import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true');

/**
 * Оплата активна: флаг сборки, /health → payments.ready,
 * или прод-сборка с URL бэкенда (не открывать отчёт бесплатно при сбое /health).
 */
function hasProductionPaymentsHost(): boolean {
  if (!import.meta.env.PROD) return false;
  const envUrl = (import.meta.env.VITE_TELEGRAM_PAYMENTS_URL as string | undefined)?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) return true;
  if (typeof window !== 'undefined') {
    try {
      return /^https?:\/\//i.test(new URL(window.location.href).origin);
    } catch {
      return false;
    }
  }
  return false;
}

export const arePaymentsActive = (serverPaymentsReady = false): boolean => {
  if (isDevPaymentBypass()) return false;
  if (isPaymentsEnabled()) return true;
  if (serverPaymentsReady) return true;
  if (hasProductionPaymentsHost()) return true;
  return false;
};

/** Расширенный отчёт без оплаты только при dev-обходе или когда оплата реально выключена. */
export const shouldBypassReportPayment = (serverPaymentsReady = false): boolean =>
  isDevPaymentBypass() || !arePaymentsActive(serverPaymentsReady);
