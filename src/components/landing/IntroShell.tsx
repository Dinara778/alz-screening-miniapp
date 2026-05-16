import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  'aria-label'?: string;
};

/** Общая оболочка тёмных intro-экранов в стиле medical-tech */
export const IntroShell = ({ children, footer, 'aria-label': ariaLabel }: Props) => (
  <section
    className="relative w-full overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-[#070b0a] text-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)] sm:rounded-3xl"
    aria-label={ariaLabel}
  >
    <div
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_100%_0%,rgb(52_211_153/0.18),transparent_55%),radial-gradient(ellipse_70%_40%_at_0%_100%,rgb(16_185_129/0.08),transparent_50%)]"
      aria-hidden
    />
    <div className="relative z-10 flex min-h-[min(92dvh,720px)] flex-col px-5 py-6 sm:px-6 sm:py-8">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="mt-4 shrink-0 pt-2">{footer}</div> : null}
    </div>
  </section>
);
