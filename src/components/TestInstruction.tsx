import { Button } from './Button';

type Props = { title: string; text: string; onStart: () => void };

export const TestInstruction = ({ title, text, onStart }: Props) => (
  <div className="space-y-4 rounded-2xl bg-white p-6 text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-100">
    <h2 className="text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>
    <p className="whitespace-pre-line text-slate-800 dark:text-slate-200">{text}</p>
    <div className="w-full pt-1">
      <Button
        type="button"
        className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
        onClick={onStart}
      >
        Понятно, начать
      </Button>
    </div>
  </div>
);
