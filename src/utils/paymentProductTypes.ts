export type ReportUnlockProduct = 'full_report' | 'subscription_1m' | 'subscription_3m';

export type TelegramInvoiceProduct = ReportUnlockProduct;

export function isReportUnlockProduct(product: string): product is ReportUnlockProduct {
  return (
    product === 'full_report' || product === 'subscription_1m' || product === 'subscription_3m'
  );
}

export function isSubscriptionProduct(product: string): boolean {
  return product === 'subscription_1m' || product === 'subscription_3m';
}

export function parsePaymentProduct(raw: string | null | undefined): TelegramInvoiceProduct | null {
  if (
    raw === 'full_report' ||
    raw === 'subscription_1m' ||
    raw === 'subscription_3m'
  ) {
    return raw;
  }
  return null;
}
