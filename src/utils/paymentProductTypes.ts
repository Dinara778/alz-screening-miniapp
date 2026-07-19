export type ReportUnlockProduct = 'full_report' | 'subscription_1m' | 'subscription_3m';

/** Разовые продукты вне отчёта/подписки (кабинет). */
export type CabinetOneTimeProduct = 'expert_program_7d' | 'consultation';

export type TelegramInvoiceProduct = ReportUnlockProduct | CabinetOneTimeProduct;

export function isReportUnlockProduct(product: string): product is ReportUnlockProduct {
  return (
    product === 'full_report' || product === 'subscription_1m' || product === 'subscription_3m'
  );
}

export function isSubscriptionProduct(product: string): boolean {
  return product === 'subscription_1m' || product === 'subscription_3m';
}

export function isCabinetOneTimeProduct(product: string): product is CabinetOneTimeProduct {
  return product === 'expert_program_7d' || product === 'consultation';
}

export function parsePaymentProduct(raw: string | null | undefined): TelegramInvoiceProduct | null {
  if (
    raw === 'full_report' ||
    raw === 'subscription_1m' ||
    raw === 'subscription_3m' ||
    raw === 'expert_program_7d' ||
    raw === 'consultation'
  ) {
    return raw;
  }
  return null;
}
