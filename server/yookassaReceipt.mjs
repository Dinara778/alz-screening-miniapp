/**
 * Данные чека 54-ФЗ для Telegram Payments + ЮKassa (createInvoiceLink / sendInvoice).
 * @see https://yookassa.ru/docs/support/payments/onboarding/integration/cms-module/telegram
 */

/**
 * @param {{ title: string, priceRub: number }} spec
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildTelegramYookassaInvoiceParams(spec, env = process.env) {
  const vatCode = Number(env.YOOKASSA_RECEIPT_VAT_CODE ?? 1);
  const taxSystemCode = Number(env.YOOKASSA_RECEIPT_TAX_SYSTEM_CODE ?? 1);
  const paymentSubject = (env.YOOKASSA_RECEIPT_PAYMENT_SUBJECT ?? 'service').trim();
  const paymentMode = (env.YOOKASSA_RECEIPT_PAYMENT_MODE ?? 'full_payment').trim();
  const description = spec.title.slice(0, 128);
  const valueRub = Number(spec.priceRub);

  const provider_data = JSON.stringify({
    receipt: {
      items: [
        {
          description,
          quantity: 1,
          amount: { value: valueRub, currency: 'RUB' },
          vat_code: vatCode,
          payment_mode: paymentMode,
          payment_subject: paymentSubject,
        },
      ],
      tax_system_code: taxSystemCode,
    },
  });

  return {
    need_email: true,
    send_email_to_provider: true,
    provider_data,
  };
}
