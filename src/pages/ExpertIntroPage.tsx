import { Button } from '../components/Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

export const ExpertIntroPage = ({ onContinue }: Props) => {
  const footer = (
    <Button
      type="button"
      variant="primary"
      className={CTA_BUTTON_CLASS}
      onClick={onContinue}
    >
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="О проекте Corta и эксперте" footer={footer} centerContent>
      <div className="flex flex-col items-center px-2 text-center sm:px-4">
        <h2 className="app-heading max-w-md leading-snug">
          «Corta — это научный подход к вашему когнитивному здоровью»
        </h2>
        <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
          <div className="relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-white/15 sm:h-[8.5rem] sm:w-[8.5rem]">
            <img
              src="/dinara-isaeva.png"
              alt="Динара Исаева"
              width={320}
              height={320}
              className="h-full w-full scale-[1.05] object-cover object-[center_40%]"
              decoding="async"
            />
          </div>
          <div className="flex max-w-xs flex-col items-center gap-1.5">
            <p className="font-signature text-[1.85rem] font-semibold leading-[1.1] text-white sm:text-[2.15rem]">
              Динара Исаева
            </p>
            <p className="text-[0.6875rem] font-medium leading-snug tracking-tight text-white/55 sm:text-xs">
              Эксперт по когнитивной эффективности
            </p>
          </div>
        </div>
      </div>
    </IntroShell>
  );
};
