import { Button } from '../components/Button';
import { CabinetAccessLink } from '../components/CabinetAccessLink';
import { IconArrowRight, IconShield } from '../components/landing/LandingIcons';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';
import { CortaLogo } from '../components/brand/CortaLogo';

type Props = {
  onContinue: () => void;
};

export const CortaIntroPage = ({ onContinue }: Props) => {
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
      <CabinetAccessLink variant="button" />
      <div className="flex shrink-0 flex-row flex-nowrap items-center justify-center gap-2 text-center text-sm leading-snug text-emerald-200/90">
        <IconShield className="block h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <span>Ваши данные под защитой</span>
      </div>
    </div>
  );

  return (
    <IntroShell aria-label="Главный экран Corta" footer={footer} centerContent>
      <div className="mx-auto w-full max-w-md space-y-5 pb-2 text-left">
        <header className="flex justify-end">
          <CortaLogo />
        </header>

        <div className="space-y-3">
          <h1 className="text-[clamp(1.625rem,6.5vw,2.25rem)] font-bold leading-[1.15] tracking-tight text-white sm:text-[2.125rem]">
            В каком режиме сейчас работает{' '}
            <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-emerald-300 decoration-clone box-decoration-clone">
              ваш мозг
            </span>
            ?
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem]">
            За {TEST_DURATION_LABEL} система оценит внимание, память и скорость обработки информации.
          </p>
          <p className="pt-2 text-sm leading-relaxed text-slate-300 sm:pt-3 sm:text-[0.9375rem]">
            Вы узнаете: ваш текущий уровень когнитивного ресурса, есть ли признаки перегрузки, рекомендации для
            быстрого восстановления ресурсов мозга.
          </p>
        </div>
      </div>
    </IntroShell>
  );
};
