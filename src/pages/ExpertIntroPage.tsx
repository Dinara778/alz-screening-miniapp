import { Button } from '../components/Button';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

export const ExpertIntroPage = ({ onContinue }: Props) => {
  const footer = (
    <Button
      type="button"
      variant="primary"
      className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
      onClick={onContinue}
    >
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="О проекте Corta и эксперте" footer={footer}>
      <div className="flex flex-col items-center px-1 sm:px-2">
        <h2 className="app-heading mt-4 text-center sm:mt-6">
          «Corta — это научный подход к вашему когнитивному здоровью»
        </h2>
        <div className="mt-10 flex w-full max-w-md flex-row items-center justify-center gap-4 sm:mt-12 sm:gap-6">
          <div className="relative h-[7.25rem] w-[7.25rem] shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-white/15 sm:h-36 sm:w-36">
            <img
              src="/dinara-isaeva.png"
              alt="Динара Исаева"
              width={320}
              height={320}
              className="h-full w-full scale-[1.05] object-cover object-[center_40%]"
              decoding="async"
            />
          </div>
          <div className="flex min-w-0 max-w-[11rem] flex-col items-start text-left sm:max-w-[13rem]">
            <p className="font-signature text-[1.85rem] font-semibold leading-[1.1] text-white sm:text-[2.15rem]">
              Динара Исаева
            </p>
            <p className="mt-1.5 text-[0.6875rem] font-medium leading-snug tracking-tight text-white/55 sm:text-xs">
              Эксперт по когнитивной эффективности
            </p>
          </div>
        </div>
      </div>
    </IntroShell>
  );
};
