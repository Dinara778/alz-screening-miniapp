import { useState } from 'react';
import { Button } from './Button';

type Props = {
  onConfirm: () => void;
  onBack: () => void;
};

export const StroopConfirmStep = ({ onConfirm, onBack }: Props) => {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-100">
      <h2 className="text-2xl font-bold text-slate-950 dark:text-slate-50">Всё ли понятно?</h2>
      <p className="text-slate-800 dark:text-slate-200">
        Перед тестом проверьте правило: нажимаете <strong>цвет букв</strong>, а не то, что написано.
      </p>

      <div className="space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Пример на экране</p>
        <p className="text-center text-4xl font-bold text-red-600">СИНИЙ</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Слово означает «синий», но буквы <strong>красные</strong>. Правильная кнопка —{' '}
          <strong>«Красный»</strong>, не «Синий».
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
          <div className="rounded-lg bg-red-600 px-2 py-2 font-bold text-white ring-2 ring-amber-500 ring-offset-2">
            Красный ✓
          </div>
          <div className="rounded-lg bg-blue-600/40 px-2 py-2 font-bold text-white/80">Синий</div>
          <div className="rounded-lg bg-green-600/40 px-2 py-2 font-bold text-white/80">Зелёный</div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-600">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
        />
        <span className="text-left text-slate-800 dark:text-slate-200">
          Я понимаю: нажимаю кнопку с <strong>цветом букв</strong>, а не со значением слова.
        </span>
      </label>

      <div className="flex w-full flex-col gap-3 pt-1">
        <Button
          type="button"
          disabled={!understood}
          className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug disabled:opacity-50 sm:py-[1.125rem] sm:text-xl"
          onClick={onConfirm}
        >
          Понятно, перехожу к тесту
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-2xl py-3 text-base font-semibold sm:py-3.5"
          onClick={onBack}
        >
          Назад к инструкции
        </Button>
      </div>
    </div>
  );
};
