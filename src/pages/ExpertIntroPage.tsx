import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/**
 * Экран после Corta intro: цитата, фото в круге слева, имя рукописным шрифтом, должность; кнопка внизу.
 */
export const ExpertIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative w-full overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)] sm:rounded-3xl dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)]"
      aria-label="О проекте Corta и эксперте"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,rgb(99_102_241/0.07),transparent_50%),radial-gradient(ellipse_100%_60%_at_100%_100%,rgb(14_165_233/0.06),transparent_45%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,rgb(99_102_241/0.12),transparent_50%),radial-gradient(ellipse_100%_60%_at_100%_100%,rgb(45_212_191/0.08),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgb(148 163 184 / 0.12) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[min(92dvh,720px)] flex-col px-6 py-8 sm:py-10">
        <div className="flex flex-1 flex-col items-center justify-center px-1 sm:px-2">
          <div className="flex w-full max-w-md flex-col items-center">
            <p className="mt-8 text-center font-sans text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:mt-10 sm:text-2xl sm:leading-snug">
              «Corta — это научный подход к вашему когнитивному здоровью»
            </p>

            <div className="mt-10 flex w-full flex-row items-center justify-center gap-4 sm:mt-12 sm:gap-6">
              <div className="relative h-[7.25rem] w-[7.25rem] shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-slate-200/90 dark:ring-slate-600/80 sm:h-36 sm:w-36">
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
                <p className="font-signature text-[1.85rem] font-semibold leading-[1.1] text-slate-900 dark:text-white sm:text-[2.15rem]">
                  Динара Исаева
                </p>
                <p className="mt-1.5 font-sans text-[0.6875rem] font-medium leading-snug tracking-tight text-slate-600 dark:text-slate-300 sm:text-xs">
                  Эксперт по когнитивной эффективности
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto w-full shrink-0 pt-6 pb-2">
          <Button
            type="button"
            variant="primary"
            className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug shadow-md sm:rounded-2xl sm:py-[1.125rem] sm:text-xl"
            onClick={onContinue}
          >
            Далее
          </Button>
        </div>
      </div>
    </section>
  );
};
