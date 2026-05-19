import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  title: string;
  text?: string;
  /** Вместо text — разметка с кнопками, иконками и т.д. */
  children?: ReactNode;
  onStart: () => void;
};

/** Миниатюра кнопки направления (как в тесте фланкер). */
export const FlankerDirButtonPreview = ({ dir }: { dir: 'left' | 'right' }) => (
  <span
    className="mx-0.5 inline-flex h-9 min-w-[2.75rem] translate-y-[0.06rem] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 px-2.5 text-xl font-bold leading-none text-white shadow-md shadow-emerald-900/25 align-middle"
    aria-hidden
  >
    {dir === 'left' ? '←' : '→'}
  </span>
);

export const TestInstruction = ({ title, text, children, onStart }: Props) => (
  <div className="space-y-4 calm-inset p-6 text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-100">
    <h2 className="app-heading">{title}</h2>
    {children ?? <p className="whitespace-pre-line calm-body dark:text-slate-200">{text}</p>}
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
