import type { TelegramInvoiceProduct } from './telegramPayments';

export type PaymentProductMeta = {
  title: string;
  priceRub: number;
  subtitle: string;
  bullets: string[];
  /** Подпись под суммой */
  paymentNote: string;
  /** Текст на зелёной плашке в окне оплаты после открытия Payform */
  awaitingReturnHint: string;
  /** Подсказка на экране записи / в уведомлении после открытия оплаты */
  redirectOpenedMessage: string;
};

export const PAYMENT_PRODUCTS: Record<TelegramInvoiceProduct, PaymentProductMeta> = {
  full_report: {
    title: 'Расширенный отчёт',
    priceRub: 399,
    subtitle: 'PDF для скачивания на основе вашего когнитивного профиля',
    bullets: [
      'Карта перегрузки и расшифровка зон',
      'Персональные рекомендации',
      'Отчёт сохраняется в приложении',
    ],
    paymentNote: 'Безопасная оплата · чек отправляется на email после оплаты',
    awaitingReturnHint:
      'После оплаты вернитесь в этот чат и нажмите зелёную кнопку ниже — отчёт откроется автоматически.',
    redirectOpenedMessage:
      'Страница оплаты открыта. После оплаты вернитесь в Corta и в окне оплаты нажмите «Я уже оплатил — открыть отчёт».',
  },
  consultation: {
    title: 'Сессия с экспертом',
    priceRub: 5490,
    subtitle: 'Персональный разбор метрик, 30–40 минут, удалённо',
    bullets: [
      'Разбор вашего индекса и доменов',
      'Ответы на вопросы по результатам',
      'После оплаты — запись на удобное время',
    ],
    paymentNote: 'Безопасная оплата · чек отправляется на email, указанный при оплате',
    awaitingReturnHint:
      'После оплаты вернитесь в Corta и нажмите зелёную кнопку «Оплата открыта» — мы подтвердим оплату и напишем вам для записи на сессию.',
    redirectOpenedMessage:
      'Страница оплаты открыта. После оплаты вернитесь в Corta и снова нажмите «Записаться на персональную сессию — 5 490 ₽» — мы подтвердим оплату и свяжемся с вами для записи.',
  },
};
