import { Button } from './Button';

type Props = { title: string; text: string; onStart: () => void };

export const TestInstruction = ({ title, text, onStart }: Props) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-slate-700 whitespace-pre-line">{text}</p>
    <Button onClick={onStart}>Понятно, начать</Button>
  </div>
);
