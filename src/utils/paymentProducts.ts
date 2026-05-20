import type { TelegramInvoiceProduct } from './telegramPayments';

export type PaymentProductMeta = {
  title: string;
  priceRub: number;
  subtitle: string;
  bullets: string[];
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
  },
};
