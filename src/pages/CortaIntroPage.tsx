import { Button } from '../components/Button';

type Props = {
  onContinue: () => void;
};

/** Первый экран: логотип Corta Lab и приветствие перед анкетой. */
export const CortaIntroPage = ({ onContinue }: Props) => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-8 px-4 text-center">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/corta-lab-logo.svg"
          alt=""
          width={120}
          height={120}
          className="h-28 w-28 drop-shadow-2xl sm:h-32 sm:w-32"
          decoding="async"
        />
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Corta Lab
          </p>
          <h1 className="text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">
            Добро пожаловать в Corta
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Здесь вы пройдёте короткий тест когнитивной эффективности и получите персональный профиль.
          </p>
        </div>
      </div>
      <Button type="button" className="min-w-[200px]" onClick={onContinue}>
        Продолжить
      </Button>
    </div>
  );
};
