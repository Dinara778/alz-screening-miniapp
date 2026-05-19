import { Button } from '../components/Button';
import { IconArrowRight, IconShield } from '../components/landing/LandingIcons';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

export const CortaIntroPage = ({ onContinue }: Props) => {
  const footer = (
    <div className="flex w-full flex-col items-center space-y-4 text-center">
      <Button
        type="button"
        className="flex w-full max-w-md items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-400 py-4 text-center text-[1.0625rem] font-bold leading-snug text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <p className="flex max-w-md items-center justify-center gap-2 text-center text-sm text-emerald-200/90">
        <IconShield className="h-5 w-5 shrink-0 text-emerald-400" />
        <span>Это бесплатно и займёт всего {TEST_DURATION_LABEL}</span>
      </p>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer} centerContent>
      <div className="mx-auto w-full max-w-md space-y-5 pb-2 text-left">
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
          <h1 className="text-[clamp(1.625rem,6.5vw,2.25rem)] font-bold leading-[1.15] tracking-tight text-white sm:text-[2.125rem]">
            Узнайте состояние вашего мозга{' '}
            <span className="text-emerald-400">за {TEST_DURATION_LABEL}</span>
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem]">
            Система помогает увидеть текущее состояние вашего когнитивного ресурса — внимания, памяти и скорости
            мышления.
          </p>
          <p className="pt-2 text-sm leading-relaxed text-slate-300 sm:pt-3 sm:text-[0.9375rem]">
            Вы получите персональный профиль, объяснение своих результатов и рекомендации для снижения перегрузки и
            повышения ясности мышления.
          </p>
        </div>
      </div>
    </IntroShell>
  );
};
