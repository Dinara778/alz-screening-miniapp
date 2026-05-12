import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/** Фон: взрослая дружная команда (Unsplash). Можно заменить на свой файл в /public. */
const HERO_BG =
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=88';

/**
 * Приветственный экран: фото людей 35+, типографика в духе muse (жирное corta. + тонкие капсы),
 * приветствие и кнопка «Продолжить».
 */
export const CortaIntroPage = ({ onContinue }: Props) => {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden rounded-2xl shadow-brand-lg sm:rounded-3xl"
      aria-label="Приветствие Corta Lab"
    >
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_BG})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/45 to-black/85 dark:from-black/85 dark:via-black/50 dark:to-black/92"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[min(92vh,640px)] flex-col justify-between px-5 py-8 text-white sm:px-8 sm:py-10">
        <div className="flex flex-1 flex-col items-center justify-center pt-4 text-center">
          <div className="w-full max-w-lg">
            <p
              className="font-display text-[clamp(3.25rem,15vw,6rem)] font-black leading-[0.92] tracking-[-0.045em] text-white antialiased drop-shadow-[0_4px_32px_rgba(0,0,0,0.45)]"
              style={{ fontFeatureSettings: '"ss01"' }}
            >
              corta<span className="font-black">.</span>
            </p>
            <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-white/25 pt-4 font-caps text-[0.62rem] font-extralight uppercase tracking-[0.32em] text-white/85 sm:text-[0.7rem] sm:tracking-[0.38em]">
              <span className="text-left">Corta Lab · studio</span>
              <span className="text-right sm:ml-auto">Since 2025</span>
            </div>
          </div>

          <div className="mt-10 max-w-md space-y-3 px-1">
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-white drop-shadow-md sm:text-3xl">
              Добро пожаловать в Corta
            </h1>
            <p className="text-sm font-light leading-relaxed text-white/90 sm:text-base">
              Короткий замер внимания и когнитивной устойчивости — персональный профиль и рекомендации без
              диагноза.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 pb-2">
          <Button
            type="button"
            variant="secondary"
            className="min-w-[220px] border-2 border-white/90 bg-white/15 px-8 text-base font-semibold text-white shadow-lg backdrop-blur-md hover:bg-white/25 dark:border-white/90 dark:bg-white/15 dark:hover:bg-white/25"
            onClick={onContinue}
          >
            Продолжить
          </Button>
          <p className="text-center text-[10px] font-light uppercase tracking-widest text-white/45">
            Фото: Unsplash · командная встреча
          </p>
        </div>
      </div>
    </section>
  );
};
