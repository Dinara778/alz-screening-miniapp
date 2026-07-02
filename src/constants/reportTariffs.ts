import type { ReportUnlockProduct } from '../utils/paymentProductTypes';

export type ReportTariffFeature = {
  text: string;
  included: boolean;
};

export type ReportTariff = {
  product: ReportUnlockProduct;
  name: string;
  tagline: string;
  priceLabel: string;
  emoji: string;
  features: ReportTariffFeature[];
  cta: string;
  highlighted?: boolean;
};

export const REPORT_TARIFFS: ReportTariff[] = [
  {
    product: 'full_report',
    name: 'Разовый разбор',
    emoji: '📋',
    tagline: 'Узнать, что происходит с мозгом, без инструмента коррекции.',
    priceLabel: '149 ₽',
    features: [
      { text: 'Полная расшифровка текущего состояния (что происходит с мозгом)', included: true },
      { text: 'Персональные рекомендации (что делать)', included: true },
      { text: 'Без интерактивной компенсации', included: false },
      { text: 'Без сохранения истории', included: false },
    ],
    cta: 'Получить разбор',
  },
  {
    product: 'subscription_1m',
    name: 'Подписка Corta',
    emoji: '🧠',
    tagline: 'Используйте Corta как инструмент ежедневного контроля когнитивного состояния:',
    priceLabel: '399 ₽ / месяц',
    highlighted: true,
    features: [
      { text: 'Проходите оценку хоть каждый день', included: true },
      { text: 'Полный разбор после каждой оценки', included: true },
      { text: 'Интерактивная компенсация (40 сек) после каждой оценки', included: true },
      { text: 'История всех результатов доступна', included: true },
    ],
    cta: 'Оформить подписку',
  },
  {
    product: 'subscription_3m',
    name: 'Подписка «Corta»',
    emoji: '✨',
    tagline: 'Всё то же самое. Просто дешевле.',
    priceLabel: '990 ₽ / 3 месяца',
    features: [
      { text: 'Все возможности месячной подписки', included: true },
      { text: 'Экономия 207 ₽ против помесячной оплаты', included: true },
      { text: 'Фиксированная цена на 3 месяца (без повышения)', included: true },
    ],
    cta: 'Выбрать 3 месяца',
  },
];

export const SUBSCRIPTION_CANCEL_HINT =
  'Подписку можно отменить в любой момент в личном кабинете — доступ сохранится до конца оплаченного периода.';
