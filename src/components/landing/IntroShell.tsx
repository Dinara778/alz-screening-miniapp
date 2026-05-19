import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  'aria-label'?: string;
};

/** Оболочка intro-экранов — calm tech */
export const IntroShell = ({ children, footer, 'aria-label': ariaLabel }: Props) => (
  <section
    className="calm-card relative w-full overflow-hidden rounded-[1.75rem] sm:rounded-3xl"
    aria-label={ariaLabel}
  >
    <div className="calm-glow" aria-hidden />
    <div className="relative z-10 flex min-h-[min(92dvh,720px)] flex-col px-5 py-6 sm:px-6 sm:py-8">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="mt-4 shrink-0 pt-2">{footer}</div> : null}
    </div>
  </section>
);
