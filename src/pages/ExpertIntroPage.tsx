import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/**
 * Экран после Corta intro: тот же визуальный «корпус», эксперт и фото в круге.
 */
export const ExpertIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)] sm:rounded-3xl dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)]"
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

      <div className="relative z-10 flex min-h-[min(92dvh,680px)] flex-col justify-between px-5 py-10 sm:px-10 sm:py-12">
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center sm:gap-10">
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5">
            <p className="font-sans text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-2xl sm:leading-snug">
              «Corta — это научный подход к вашему когнитивному здоровью»
            </p>
            <div className="w-full max-w-md border-t border-slate-200/80 pt-5 dark:border-slate-600/60">
              <p className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                Динара Исаева
              </p>
              <p className="mt-1 font-sans text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                Эксперт по когнитивной эффективности
              </p>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200/90 bg-slate-50/90 px-6 py-8 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-800/80 dark:ring-slate-700/40 sm:rounded-3xl sm:px-8 sm:py-10">
            <div className="relative aspect-square h-36 w-36 shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-lg ring-offset-2 ring-offset-slate-100 dark:ring-slate-600 dark:ring-offset-slate-800 sm:h-40 sm:w-40">
              <img
                src="/dinara-isaeva.png"
                alt="Динара Исаева"
                width={320}
                height={320}
                className="h-full w-full scale-[1.08] object-cover object-[center_32%]"
                decoding="async"
              />
            </div>
          </div>

          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-600" />
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-500" />
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-600" />
          </div>
        </div>

        <div className="mt-10 -mx-5 pb-1 sm:-mx-10">
          <Button
            type="button"
            variant="primary"
            className="w-full rounded-2xl px-5 py-4 text-base font-bold shadow-md sm:rounded-3xl sm:py-[1.125rem] sm:text-lg"
            onClick={onContinue}
          >
            Далее
          </Button>
        </div>
      </div>
    </section>
  );
};
