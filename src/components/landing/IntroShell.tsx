import type { ReactNode } from 'react';
import { CalmCardShell } from '../CalmCardShell';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Вертикально центрировать контент между шапкой и CTA */
  centerContent?: boolean;
  /**
   * Контент и CTA подряд сверху, без пустого «моста» flex-1.
   * Для экрана со списком (оценка профиля).
   */
  compact?: boolean;
  'aria-label'?: string;
};

/** Оболочка intro-экранов — calm tech; CTA внизу */
export const IntroShell = ({
  children,
  footer,
  centerContent,
  compact = false,
  'aria-label': ariaLabel,
}: Props) => {
  const shouldCenter = !compact && (centerContent ?? Boolean(footer));

  return (
    <CalmCardShell
      as="section"
      aria-label={ariaLabel}
      fill={!compact}
      overflowVisible
      innerClassName="px-5 py-4 sm:px-6 sm:py-5"
    >
      {footer ? (
        compact ? (
          <>
            <div className="shrink-0">{children}</div>
            <div className="mt-4 shrink-0 space-y-3 border-t border-white/10 pt-3">
              {footer}
            </div>
          </>
        ) : (
          <>
            <div
              className={`min-h-0 overflow-y-auto overscroll-contain ${
                shouldCenter ? 'flex flex-1 flex-col justify-center' : 'shrink-0'
              }`}
            >
              {children}
            </div>
            <div className="mt-auto shrink-0 space-y-3 border-t border-white/10 pt-3">
              {footer}
            </div>
          </>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      )}
    </CalmCardShell>
  );
};
