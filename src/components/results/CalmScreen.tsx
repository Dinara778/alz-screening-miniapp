import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Верхняя подпись (опционально) */
  kicker?: string;
  /** Крупный жирный заголовок секции (экран индекса) */
  kickerProminent?: boolean;
  /** center — метрика по центру; top — длинная расшифровка со скроллом */
  contentAlign?: 'center' | 'top';
};

/** Полноэкранная оболочка calm tech: тёмный фон, воздух, CTA внизу. */
export const CalmScreen = ({
  children,
  footer,
  kicker,
  kickerProminent = false,
  contentAlign = 'center',
}: Props) => (
  <div className="calm-results flex min-h-0 flex-1 flex-col text-white">
    {kicker ? (
      <p
        className={
          kickerProminent
            ? 'shrink-0 px-2 pb-1 pt-5 text-center text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-white/80 sm:pt-6 sm:text-sm'
            : 'shrink-0 px-1 pt-1 text-center text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/40'
        }
      >
        {kicker}
      </p>
    ) : null}
    <div
      className={
        contentAlign === 'top'
          ? 'flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-4'
          : 'flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-8'
      }
    >
      {children}
    </div>
    {footer ? (
      <div className="mt-auto shrink-0 space-y-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4">
        {footer}
      </div>
    ) : null}
  </div>
);
