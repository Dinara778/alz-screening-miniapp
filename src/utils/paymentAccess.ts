/**
 * PAYMENT ACCESS — единственная точка правды для доступа к отчёту и подписке.
 *
 * UI (ResultPage, FullReportPage, PaymentCheckoutSheet, AppContext) импортирует
 * ТОЛЬКО этот модуль для решений «можно ли открыть отчёт / оплату».
 *
 * Инварианты (не менять без обновления paymentAccess.test.ts):
 * 1. Расширенный отчёт — только после confirmReportAccess (сервер) для sessionId.
 * 2. Разовый отчёт (full_report) ≠ подписка (subscription_*).
 * 3. report_paid_<sessionId> в localStorage — кэш; при отказе сервера очищается.
 * 4. Подписка в localStorage привязана к email; чужой кэш не даёт доступ.
 * 5. Оплата разового отчёта не считается активной подпиской при checkout подписки.
 * 6. Активная подписка по email открывает отчёт для любой новой sessionId (повторное прохождение).
 */
import type { ReportUnlockProduct } from './paymentProductTypes';
import { isSubscriptionProduct } from './paymentProductTypes';
import { arePaymentsActive, isDevPaymentBypass } from './paymentStub';
import { isStandaloneWeb } from './runtime';
import {
  confirmWebReportAccess,
  confirmWebSubscriptionAccess,
  syncSubscriptionAccessFromServer,
} from './webPayments';

export type PaymentAccessContext = {
  sessionId: string;
  payerEmail?: string | null;
  serverPaymentsReady?: boolean;
};

export const reportPaidStorageKey = (sessionId: string) => `report_paid_${sessionId}`;

/** Локальный кэш «отчёт оплачен для этой сессии» (не доверять без confirm). */
export function grantReportAccess(sessionId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(reportPaidStorageKey(sessionId), '1');
  } catch {
    /* ignore */
  }
}

export function denyReportAccess(sessionId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(reportPaidStorageKey(sessionId));
  } catch {
    /* ignore */
  }
}

/** Быстрая локальная проверка (для UI-черновиков; перед открытием отчёта — confirmReportAccess). */
export function isReportPaidLocal(sessionId: string, serverPaymentsReady = false): boolean {
  if (isDevPaymentBypass()) return true;
  if (!arePaymentsActive(serverPaymentsReady)) return true;
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(reportPaidStorageKey(sessionId)) === '1';
  } catch {
    return false;
  }
}

/** @deprecated Используйте isReportPaidLocal */
export const isReportPaidUnlocked = isReportPaidLocal;

/** Серверное подтверждение оплаты разового отчёта для sessionId. */
export async function confirmReportAccess(ctx: PaymentAccessContext): Promise<boolean> {
  const { sessionId, payerEmail, serverPaymentsReady = false } = ctx;
  if (isDevPaymentBypass()) return true;
  if (!arePaymentsActive(serverPaymentsReady)) return true;

  if (isStandaloneWeb()) {
    const ok = await confirmWebReportAccess(sessionId, payerEmail ?? undefined, serverPaymentsReady);
    if (!ok) denyReportAccess(sessionId);
    return ok;
  }

  const { verifyReportPaymentOnServer } = await import('./telegramPayments');
  const recovered = await verifyReportPaymentOnServer(sessionId, payerEmail ?? undefined);
  if (recovered.ok) return true;
  denyReportAccess(sessionId);
  return false;
}

/** Серверное подтверждение активной подписки (разовый отчёт не считается подпиской). */
export async function confirmSubscriptionAccess(
  ctx: PaymentAccessContext & { product: 'subscription_1m' | 'subscription_3m' },
): Promise<boolean> {
  const { sessionId, product, payerEmail, serverPaymentsReady = false } = ctx;
  return confirmWebSubscriptionAccess(
    sessionId,
    product,
    payerEmail ?? undefined,
    serverPaymentsReady,
  );
}

/** Проверка «уже оплачено» для конкретного продукта в checkout. */
export async function confirmProductPaid(
  ctx: PaymentAccessContext & { product: ReportUnlockProduct },
): Promise<boolean> {
  if (ctx.product === 'full_report') {
    return confirmReportAccess(ctx);
  }
  if (isSubscriptionProduct(ctx.product)) {
    return confirmSubscriptionAccess({
      ...ctx,
      product: ctx.product,
    });
  }
  return false;
}

/** Тексты экрана «уже оплачено» в checkout (null = показать обычную оплату). */
export function alreadyPaidCheckoutCopy(
  product: ReportUnlockProduct,
): { title: string; message: string; cta: string } | null {
  if (product === 'full_report') {
    return {
      title: 'Доступ уже есть',
      message: 'Оплата учтена. Откройте расширенный отчёт.',
      cta: 'Открыть расширенный отчёт',
    };
  }
  if (isSubscriptionProduct(product)) {
    return {
      title: 'Подписка уже активна',
      message: 'Подписка уже активна на ваш email. Можно продолжить в личный кабинет.',
      cta: 'Продолжить',
    };
  }
  return null;
}

/** Синхронизировать подписку с сервером при смене email в анкете. */
export { syncSubscriptionAccessFromServer };
