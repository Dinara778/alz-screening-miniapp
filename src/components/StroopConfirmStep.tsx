import { useState } from 'react';
import { Button } from './Button';

type Props = {
  onConfirm: () => void;
};

export const StroopConfirmStep = ({ onConfirm }: Props) => {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="calm-inset min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        <h2 className="app-heading">Всё ли понятно?</h2>
        <p className="calm-body">
          Перед тестом проверьте правило: нажимаете <strong>цвет букв</strong>, а не то, что написано.
        </p>

        <div className="space-y-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Пример на экране</p>
          <p className="text-center text-4xl font-bold text-red-500">СИНИЙ</p>
          <p className="text-sm calm-body text-white/80">
            Слово означает «синий», но буквы <strong>красные</strong>. Правильная кнопка —{' '}
            <strong>«Красный»</strong>, не «Синий».
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
            <div className="rounded-lg bg-red-600 px-2 py-2 font-bold text-white ring-2 ring-amber-500 ring-offset-2 ring-offset-[#0a0e0d]">
              Красный ✓
            </div>
            <div className="rounded-lg bg-blue-600/40 px-2 py-2 font-bold text-white/80">Синий</div>
            <div className="rounded-lg bg-green-600/40 px-2 py-2 font-bold text-white/80">Зелёный</div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span className="text-left calm-body">
            Я понимаю: нажимаю кнопку с <strong>цветом букв</strong>, а не со значением слова.
          </span>
        </label>
      </div>

      <Button
        type="button"
        disabled={!understood}
        className="w-full shrink-0 rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug disabled:opacity-50 sm:py-[1.125rem] sm:text-xl"
        onClick={onConfirm}
      >
        Понятно, далее
      </Button>
    </div>
  );
};
