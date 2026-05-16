import { Button } from '../components/Button';
import {
  IconArrowRight,
  IconPersonal,
  IconScience,
  IconShield,
  IconShieldLock,
} from '../components/landing/LandingIcons';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

const VALUE_PROPS = [
  {
    Icon: IconScience,
    title: 'Научно обосновано',
    text: 'Методики на основе когнитивной нейронауки',
  },
  {
    Icon: IconPersonal,
    title: 'Персонализировано',
    text: 'Анализ именно вашего когнитивного состояния',
  },
  {
    Icon: IconShieldLock,
    title: 'Конфиденциально',
    text: 'Данные обрабатываются безопасно и по политике конфиденциальности',
  },
] as const;

export const CortaIntroPage = ({ onContinue }: Props) => {
  const footer = (
    <div className="space-y-4">
      <Button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-400 py-4 text-[1.0625rem] font-bold leading-snug text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать тест бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <p className="flex items-center justify-start gap-2 text-left text-sm text-emerald-200/90">
        <IconShield className="h-5 w-5 shrink-0 text-emerald-400" />
        <span>Это бесплатно и займёт всего 10 минут</span>
      </p>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer} tone="dark">
      <div className="space-y-5 pb-2 text-left">
        <header className="flex justify-end">
          <img
            src="/corta-lab-logo.svg"
            alt="Corta"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 select-none opacity-95"
          />
        </header>

        <div className="space-y-3">
          <h1 className="text-lg font-bold leading-snug text-white sm:text-xl">
            Узнайте свой когнитивный профиль{' '}
            <span className="text-emerald-400">за 10 минут</span>
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem]">
            Научный тест оценивает память, внимание и скорость реакции. Вы получите персональные рекомендации
            для улучшения когнитивных функций.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {VALUE_PROPS.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/25">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold leading-snug text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </IntroShell>
  );
};
