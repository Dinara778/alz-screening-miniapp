import { Button } from '../components/Button';
import { IconArrowRight, IconShield } from '../components/landing/LandingIcons';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';
import { publicAsset } from '../utils/publicAsset';

type Props = {
  onContinue: () => void;
  onOpenUserAgreement: () => void;
};

export const CortaIntroPage = ({ onContinue, onOpenUserAgreement }: Props) => {
  const footer = (
    <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3">
      <Button
        type="button"
        className="cta-shimmer flex w-full items-center justify-center gap-2 rounded-2xl border-0 !bg-none py-4 text-center text-[1.0625rem] font-bold leading-snug !from-transparent !to-transparent hover:!from-transparent hover:!to-transparent sm:py-[1.125rem] sm:text-xl"
        onClick={onContinue}
      >
        <span>Начать бесплатно</span>
        <IconArrowRight className="h-5 w-5 shrink-0" />
      </Button>
      <div className="flex shrink-0 flex-col items-center gap-2 text-center">
        <div className="flex flex-row flex-nowrap items-center justify-center gap-2 text-sm leading-snug text-emerald-200/90">
          <IconShield className="block h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <span>Ваши данные под защитой</span>
        </div>
        <button
          type="button"
          onClick={onOpenUserAgreement}
          className="text-xs font-medium text-emerald-300/90 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200 sm:text-sm"
        >
          Пользовательское соглашение
        </button>
      </div>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer} centerContent>
      <div className="mx-auto w-full max-w-md space-y-5 pb-2 text-left">
        <header className="flex justify-end">
          <img
            src={publicAsset('/corta-lab-logo.svg')}
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
