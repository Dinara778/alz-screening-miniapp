import { IconPersonal, IconScience, IconShieldLock } from '../components/landing/LandingIcons';

export const CORTA_VALUE_PROPS = [
  {
    Icon: IconScience,
    title: 'Основано на когнитивных науках и поведенческих методиках',
  },
  {
    Icon: IconPersonal,
    title: 'Индивидуальный анализ вашего состояния, а не усреднённые нормы',
  },
  {
    Icon: IconShieldLock,
    title: 'Данные обрабатываются безопасно и не передаются третьим лицам',
  },
] as const;
