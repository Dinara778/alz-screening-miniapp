/** Сообщение, пока оплата не подключена (Prodamus / счета). */
export const PAYMENT_STUB_MESSAGE =
  'Оплата скоро будет доступна. По вопросам напишите на hello@bookvolon.ru или в техподдержку в Telegram.';

/** Включить реальную оплату: VITE_PAYMENTS_ENABLED=true при сборке. По умолчанию — заглушка. */
export const isPaymentsEnabled = (): boolean =>
  import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

export const isPaymentsStubbed = (): boolean => !isPaymentsEnabled();
