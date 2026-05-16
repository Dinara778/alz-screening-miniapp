import { Button } from '../components/Button';
import { IconArrowRight, IconChart, IconLock, IconShield, IconTarget } from '../components/landing/LandingIcons';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

const VALUE_PROPS = [
  {
    Icon: IconTarget,
    title: 'Научно обосновано',
    text: 'Методики на основе когнитивной нейронауки',
  },
  {
    Icon: IconChart,
    title: 'Персонализировано',
    text: 'Анализ именно вашего когнитивного состояния',
  },
  {
    Icon: IconLock,
    title: 'Конфиденциально',
    text: 'Ваши данные надёжно защищены и никуда не передаются',
  },
] as const;

export const CortaIntroPage = ({ onContinue }: Props) => {
  const footer = (
    <div className="space-y-4">
      <Button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать тест бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-sm text-emerald-800/90 dark:text-emerald-200/90">
        <IconShield className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <span>Это бесплатно и займёт всего 10 минут</span>
      </p>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer}>
      <div className="space-y-5 pb-4">
        <header className="flex justify-end">
          <img
            src="/corta-lab-logo.svg"
            alt="Corta"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 select-none"
          />
        </header>

        <div className="space-y-3 pr-1 text-center sm:text-left">
          <h1 className="font-display text-[clamp(1.5rem,6.5vw,2rem)] font-black leading-[1.12] tracking-tight text-slate-900 dark:text-white">
            Узнайте свой когнитивный профиль{' '}
            <span className="text-emerald-700 dark:text-emerald-400">за 10 минут</span>
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[0.9375rem]">
            Научный тест оценивает память, внимание и скорость реакции. Вы получите персональные рекомендации
            для улучшения когнитивных функций.
          </p>
        </div>

        <ul className="mx-auto flex max-w-[17rem] flex-col gap-2 sm:max-w-xs">
          {VALUE_PROPS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex flex-col items-center rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-center dark:border-emerald-800/50 dark:bg-emerald-950/30"
            >
              <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-800 dark:text-emerald-400">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              <p className="mt-0.5 text-[0.6875rem] leading-snug text-slate-600 dark:text-slate-400">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </IntroShell>
  );
};
