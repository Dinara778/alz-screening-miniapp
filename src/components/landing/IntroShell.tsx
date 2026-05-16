import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  'aria-label'?: string;
  /** dark — первый экран (как на референсе); default — остальные intro */
  tone?: 'default' | 'dark';
};

const shellClass = {
  default:
    'border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)] dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100',
  dark: 'border-emerald-500/20 bg-[#070b0a] text-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)]',
};

/** Оболочка intro-экранов */
export const IntroShell = ({ children, footer, 'aria-label': ariaLabel, tone = 'default' }: Props) => (
  <section
    className={`relative w-full overflow-hidden rounded-[1.75rem] sm:rounded-3xl ${shellClass[tone]}`}
    aria-label={ariaLabel}
  >
    {tone === 'default' ? (
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,rgb(99_102_241/0.07),transparent_50%),radial-gradient(ellipse_100%_60%_at_100%_100%,rgb(14_165_233/0.06),transparent_45%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,rgb(99_102_241/0.12),transparent_50%),radial-gradient(ellipse_100%_60%_at_100%_100%,rgb(45_212_191/0.08),transparent_45%)]"
        aria-hidden
      />
    ) : tone === 'dark' ? (
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_100%_0%,rgb(52_211_153/0.22),transparent_55%),radial-gradient(ellipse_70%_40%_at_0%_100%,rgb(16_185_129/0.1),transparent_50%)]"
        aria-hidden
      />
    ) : null}
    <div className="relative z-10 flex min-h-[min(92dvh,720px)] flex-col px-5 py-6 sm:px-6 sm:py-8">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="mt-4 shrink-0 pt-2">{footer}</div> : null}
    </div>
  </section>
);
