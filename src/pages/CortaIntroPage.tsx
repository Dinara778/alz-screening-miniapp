import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/** Локальное фото офисной команды (Unsplash License), файл в public/hero. */
const HERO_SRC = '/hero/corta-intro-office.jpg';

/**
 * Приветственный экран: фото, типографика corta., приветствие и кнопка «Начать».
 * Nunito только для corta. и слова «Corta»; остальное — font-sans (Plus Jakarta Sans).
 */
export const CortaIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-2xl shadow-brand-lg ring-1 ring-emerald-200/40 sm:rounded-3xl dark:ring-emerald-800/30"
      aria-label="Приветствие Corta Lab"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_SRC})` }}
        aria-hidden
      />
      {/* Светлый «воздух» по центру, чуть затемнение сверху/снизу для читаемости */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/10 to-slate-950/70 dark:from-slate-950/70 dark:via-slate-950/25 dark:to-slate-950/85"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[min(92vh,640px)] flex-col justify-between px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-1 flex-col items-center justify-center pt-2 text-center">
          <div className="w-full max-w-lg">
            <p
              className="font-display text-[clamp(3.25rem,15vw,6rem)] font-black leading-[0.92] tracking-[-0.045em] text-white antialiased drop-shadow-[0_4px_28px_rgba(0,0,0,0.5)]"
              style={{ fontFeatureSettings: '"ss01"' }}
            >
              corta<span className="font-black">.</span>
            </p>
          </div>

          <div className="mt-8 w-full max-w-md rounded-3xl border border-white/50 bg-white/88 px-5 py-6 text-slate-800 shadow-xl backdrop-blur-md dark:border-emerald-800/40 dark:bg-slate-900/80 dark:text-slate-100 sm:px-7 sm:py-7">
            <h1 className="font-sans text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              Добро пожаловать в <span className="font-display font-black tracking-tight text-emerald-900 dark:text-emerald-200">Corta</span>
            </h1>
            <p className="mt-3 font-sans text-sm font-normal leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
              Короткий замер внимания и когнитивной устойчивости — персональный профиль и адресные рекомендации
              для когнитивного благополучия.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center pb-1">
          <Button
            type="button"
            variant="sell"
            className="min-w-[240px] px-10 py-3.5 text-base font-bold shadow-2xl shadow-black/40 ring-2 ring-white/40 hover:ring-white/60"
            onClick={onContinue}
          >
            Начать
          </Button>
        </div>
      </div>
    </section>
  );
};
