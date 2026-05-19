import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Верхняя подпись (опционально) */
  kicker?: string;
};

/** Полноэкранная оболочка calm tech: тёмный фон, воздух, CTA внизу. */
export const CalmScreen = ({ children, footer, kicker }: Props) => (
  <div className="calm-results flex min-h-0 flex-1 flex-col text-white">
    {kicker ? (
      <p className="shrink-0 px-1 pt-1 text-center text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/40">
        {kicker}
      </p>
    ) : null}
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-8">{children}</div>
    {footer ? <div className="shrink-0 space-y-3 px-1 pb-2 pt-6">{footer}</div> : null}
  </div>
);
