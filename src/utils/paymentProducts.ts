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
    title: 'Расшифровка результата + рекомендации по улучшению вашего профиля',
    priceRub: 199,
    subtitle: '',
    bullets: [
      'Карта перегрузки и расшифровка зон',
      'Персональные рекомендации по улучшению состояния',
      'PDF сохраняется на вашем устройстве',
    ],
    paymentNote: 'Чек на email после оплаты',
    awaitingReturnHint:
      'После успешной оплаты отчёт откроется автоматически. Если этого не произошло — напишите в техподдержку.',
    redirectOpenedMessage:
      'Страница оплаты открыта. После успешной оплаты отчёт откроется автоматически. Если этого не произошло — напишите в техподдержку.',
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
