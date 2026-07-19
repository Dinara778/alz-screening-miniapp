/** Каталог цен продуктов (рубли). Единый источник для записи платежей и дашборда. */
export const PRODUCT_PRICE_RUB = {
  full_report: 149,
  subscription_1m: 499,
  subscription_3m: 990,
  consultation: 5490,
  expert_program_7d: 7990,
};

export function catalogPriceRub(product) {
  const key = String(product ?? '').trim();
  const price = PRODUCT_PRICE_RUB[key];
  return Number.isFinite(price) ? price : null;
}

/** Сумма для записи/дашборда: факт оплаты, иначе цена из каталога. */
export function resolveAmountRub(amountRub, product) {
  const paid = Number(amountRub);
  if (Number.isFinite(paid) && paid > 0) return Number(paid.toFixed(2));
  const catalog = catalogPriceRub(product);
  if (catalog != null) return catalog;
  return null;
}

export function paymentTypeForProduct(product) {
  const key = String(product ?? '').trim();
  if (key === 'subscription_1m' || key === 'subscription_3m') return 'subscription';
  return 'one_time';
}
