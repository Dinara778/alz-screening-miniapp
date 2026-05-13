import { Button } from './Button';

type Props = { title: string; text: string; onStart: () => void };

export const TestInstruction = ({ title, text, onStart }: Props) => (
  <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="whitespace-pre-line text-slate-700">{text}</p>
    <div className="w-full pt-1">
      <Button
        type="button"
        className="w-full rounded-2xl py-4 text-base font-bold sm:py-[1.125rem] sm:text-lg"
        onClick={onStart}
      >
        Понятно, начать
      </Button>
    </div>
  </div>
);
