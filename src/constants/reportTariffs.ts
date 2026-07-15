import type { ReportUnlockProduct } from '../utils/paymentProductTypes';

export type ReportTariff = {
  product: ReportUnlockProduct;
  name: string;
  emoji: string;
  priceAmount: string;
  pricePeriod: string;
  sectionTitle: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
};

export const REPORT_TARIFFS: ReportTariff[] = [
  {
    product: 'full_report',
    name: 'Разовый разбор',
    emoji: '📋',
    priceAmount: '149 ₽',
    pricePeriod: 'один раз',
    sectionTitle: 'Понять свой результат сейчас',
    features: [
      'Расшифровка оценки',
      'Сильные и слабые стороны',
      'Персональные рекомендации',
    ],
    cta: 'Получить разбор',
  },
  {
    product: 'subscription_1m',
    name: 'Подписка',
    emoji: '⭐',
    priceAmount: '499 ₽',
    pricePeriod: 'в месяц',
    sectionTitle: 'Отслеживать изменения мозга',
    features: [
      'Сравнение изменений день за днём',
      'Полные отчёты',
      'Быстрая практика для восстановления',
    ],
    highlighted: true,
    badge: 'Самый популярный',
    cta: 'Оформить подписку',
  },
];

export const SUBSCRIPTION_CANCEL_HINT =
  'Подписку можно отменить в кабинете — доступ сохранится до конца оплаченного периода.';
