import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Вертикально центрировать контент между шапкой и CTA (по умолчанию — да, если есть footer) */
  centerContent?: boolean;
  'aria-label'?: string;
};

/** Оболочка intro-экранов — calm tech; CTA внизу, контент по центру при коротком тексте */
export const IntroShell = ({
  children,
  footer,
  centerContent,
  'aria-label': ariaLabel,
}: Props) => {
  const shouldCenter = centerContent ?? Boolean(footer);

  return (
    <section
      className="calm-card relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.75rem] sm:rounded-3xl"
      aria-label={ariaLabel}
    >
      <div className="calm-glow" aria-hidden />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
        {footer ? (
          <>
            <div
              className={`min-h-0 flex-1 overflow-y-auto ${shouldCenter ? 'flex flex-col justify-center' : ''}`}
            >
              {children}
            </div>
            <div className="mt-auto shrink-0 space-y-3 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        )}
      </div>
    </section>
  );
};
