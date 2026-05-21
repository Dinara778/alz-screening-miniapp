import type { ReactNode } from 'react';
import { Button } from '../Button';
import { CalmCardShell } from '../CalmCardShell';

type Props = {
  title: string;
  children: ReactNode;
  onBack: () => void;
};

export const LegalDocShell = ({ title, children, onBack }: Props) => (
  <CalmCardShell fill innerClassName="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
    <div className="mb-4 shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-emerald-300/90 transition hover:text-emerald-200"
      >
        ← Назад
      </button>
      <h1 className="app-heading mt-3">{title}</h1>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain calm-inset space-y-4 p-4 calm-body text-sm leading-relaxed text-white/88">
      {children}
    </div>
    <div className="mt-4 shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      <Button type="button" variant="secondary" className="w-full" onClick={onBack}>
        Закрыть
      </Button>
    </div>
  </CalmCardShell>
);
