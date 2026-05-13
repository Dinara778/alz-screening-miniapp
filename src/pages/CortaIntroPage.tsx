import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/**
 * Первый экран: нейтральная «редакторская» палитра, акцент бренда только в логотипе и слове Corta.
 * Фон не зависит от зелёного градиента приложения — отдельно от Welcome.
 */
export const CortaIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)] sm:rounded-3xl dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)]"
      aria-label="Приветствие Corta Lab"
    >
      {/* Мягкий «воздух» — без зелёного заливки */}
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
          <div className="flex flex-col items-center gap-5 sm:gap-6">
            <img
              src="/corta-lab-logo.svg"
              alt="Corta Lab"
              width={144}
              height={144}
              className="h-[6.25rem] w-[6.25rem] select-none drop-shadow-sm sm:h-32 sm:w-32"
            />
            <p
              className="font-display text-[clamp(2.5rem,11vw,4.75rem)] font-black leading-[0.92] tracking-[-0.04em] text-slate-900 antialiased dark:text-white"
              style={{ fontFeatureSettings: '"ss01"' }}
            >
              corta<span className="text-emerald-600 dark:text-emerald-400">.</span>
            </p>
          </div>

          <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200/90 bg-slate-50/90 px-6 py-6 text-left shadow-sm ring-1 ring-slate-100/80 backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-800/80 dark:ring-slate-700/40 sm:rounded-3xl sm:px-8 sm:py-7">
            <div className="mb-4 h-1 w-12 rounded-full bg-gradient-to-r from-indigo-500 to-teal-500 opacity-90" aria-hidden />
            <h1 className="font-sans text-2xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-[1.65rem] sm:leading-tight">
              Добро пожаловать в{' '}
              <span className="font-display font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">
                Corta
              </span>
            </h1>
            <p className="mt-4 font-sans text-[0.95rem] font-medium leading-relaxed tracking-[-0.01em] text-slate-800 dark:text-slate-200 sm:text-base">
              Тест на память, внимание, скорость реакции. Объективно и сразу.
            </p>
            <p className="mt-3 font-sans text-sm font-normal leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[0.9375rem]">
              + адресные рекомендации по вашему когнитивному профилю
            </p>
          </div>

          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-600" />
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-500" />
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-600" />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center pb-1">
          <Button
            type="button"
            variant="sell"
            className="min-w-[240px] px-10 py-3.5 text-base font-bold shadow-xl shadow-red-600/25 ring-2 ring-red-500/20 hover:ring-red-400/35"
            onClick={onContinue}
          >
            Начать
          </Button>
        </div>
      </div>
    </section>
  );
};
