import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/**
 * Приветственный экран: светлый фон, логотип над corta., Nunito только для бренда.
 */
export const CortaIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50/95 shadow-brand-lg ring-1 ring-orange-100/60 sm:rounded-3xl dark:border-emerald-800/50 dark:from-emerald-950/90 dark:via-slate-900 dark:to-emerald-950/80 dark:ring-orange-900/20"
      aria-label="Приветствие Corta Lab"
    >
      {/* Ненавязчивый «бумажный» ритм */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgb(6 78 59 / 0.07) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-8 h-48 w-48 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-12 bottom-32 h-40 w-40 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-500/10"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent dark:via-emerald-600/30" aria-hidden />

      <div className="relative z-10 flex min-h-[min(92vh,640px)] flex-col justify-between px-5 py-9 sm:px-10 sm:py-11">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 pt-2 text-center sm:gap-6">
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <img
              src="/corta-lab-logo.svg"
              alt="Corta Lab"
              width={144}
              height={144}
              className="h-[6.5rem] w-[6.5rem] select-none drop-shadow-md sm:h-36 sm:w-36"
            />
            <p
              className="font-display text-[clamp(2.75rem,12vw,5.25rem)] font-black leading-[0.92] tracking-[-0.045em] text-emerald-950 antialiased dark:text-emerald-50"
              style={{ fontFeatureSettings: '"ss01"' }}
            >
              corta<span className="font-black">.</span>
            </p>
          </div>

          <div className="mx-auto mt-1 w-full max-w-md rounded-2xl border border-emerald-200/60 bg-white/55 px-5 py-5 shadow-sm backdrop-blur-sm dark:border-emerald-700/40 dark:bg-slate-800/55 sm:px-7 sm:py-6">
            <h1 className="font-sans text-2xl font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Добро пожаловать в <span className="font-display font-black tracking-tight text-emerald-900 dark:text-emerald-200">Corta</span>
            </h1>
            <p className="mt-3 font-sans text-sm font-normal leading-relaxed text-slate-700 dark:text-slate-200 sm:text-base">
              Тест на память, внимание, скорость реакции. Объективно и сразу.
            </p>
            <p className="mt-2.5 font-sans text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
              + адресные рекомендации по вашему когнитивному профилю
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2.5" aria-hidden>
            <span className="h-1 w-1 rounded-full bg-emerald-700/25 dark:bg-emerald-300/30" />
            <span className="h-1 w-1 rounded-full bg-emerald-700/20 dark:bg-emerald-300/25" />
            <span className="h-1 w-1 rounded-full bg-emerald-700/25 dark:bg-emerald-300/30" />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center pb-1">
          <Button
            type="button"
            variant="sell"
            className="min-w-[240px] px-10 py-3.5 text-base font-bold shadow-xl shadow-red-600/30 ring-2 ring-red-500/25 hover:ring-red-400/40"
            onClick={onContinue}
          >
            Начать
          </Button>
        </div>
      </div>
    </section>
  );
};
