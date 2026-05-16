import { Button } from '../components/Button';
import {
  IconArrowRight,
  IconChart,
  IconLock,
  IconShield,
  IconTarget,
} from '../components/landing/LandingIcons';
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
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-400 py-4 text-[1.0625rem] font-bold leading-snug text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать тест бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-sm text-emerald-200/90">
        <IconShield className="h-5 w-5 shrink-0 text-emerald-400" />
        <span>Это бесплатно и займёт всего 10 минут</span>
      </p>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer}>
      <div className="space-y-6 pb-4">
        <header className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-950/80 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-emerald-300">
            наука о вашем мозге
          </span>
          <img
            src="/corta-lab-logo.svg"
            alt="Corta"
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 select-none opacity-95"
          />
        </header>

        <div className="space-y-4 pr-2">
          <h1 className="font-display text-[clamp(1.65rem,7vw,2.25rem)] font-black leading-[1.1] tracking-tight text-white">
            Узнайте свой когнитивный профиль{' '}
            <span className="text-emerald-400">за 10 минут</span>
          </h1>
          <p className="text-[0.9375rem] leading-relaxed text-slate-300 sm:text-base">
            Научный тест оценивает память, внимание и скорость реакции. Вы получите персональные рекомендации
            для улучшения когнитивных функций.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3 sm:gap-3">
          {VALUE_PROPS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-3 rounded-xl border border-emerald-500/15 bg-emerald-950/40 p-4 sm:flex-col sm:items-center sm:text-center"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-snug text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </IntroShell>
  );
};
