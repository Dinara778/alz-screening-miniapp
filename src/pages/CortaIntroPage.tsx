import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/** Фон героя; при желании замените на свой файл в /public. */
const HERO_BG =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=88';

/**
 * Приветственный экран: фото, типографика corta., приветствие и кнопка «Начать».
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
          </div>

          <div className="mt-10 max-w-md space-y-3 px-1">
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-white drop-shadow-md sm:text-3xl">
              Добро пожаловать в Corta
            </h1>
            <p className="text-sm font-light leading-relaxed text-white/90 sm:text-base">
              Короткий замер внимания и когнитивной устойчивости — персональный профиль и адресные рекомендации
              для когнитивного благополучия.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center pb-2">
          <Button
            type="button"
            variant="sell"
            className="min-w-[240px] px-10 py-3.5 text-base font-bold shadow-2xl shadow-black/50 ring-2 ring-white/35 hover:ring-white/55"
            onClick={onContinue}
          >
            Начать
          </Button>
        </div>
      </div>
    </section>
  );
};
