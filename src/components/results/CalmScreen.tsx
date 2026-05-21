import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Верхняя подпись (опционально) */
  kicker?: ReactNode;
  /** Крупный заголовок секции (экран индекса) */
  kickerProminent?: boolean;
  /** Заголовок профиля: «Ваш когнитивный профиль» */
  kickerProfile?: boolean;
  /** center — метрика; readable — расшифровка по центру со скроллом */
  contentAlign?: 'center' | 'readable';
};

/** Полноэкранная оболочка calm tech: фон как у приложения, CTA внизу. */
export const CalmScreen = ({
  children,
  footer,
  kicker,
  kickerProminent = false,
  kickerProfile = false,
  contentAlign = 'center',
}: Props) => (
  <div className="calm-results flex min-h-0 flex-1 flex-col text-white">
    {kicker ? (
      <p
        className={
          kickerProfile
            ? 'shrink-0 px-3 pb-2 pt-5 text-center text-lg font-semibold text-white/95 sm:pt-6 sm:text-xl'
            : kickerProminent
              ? 'shrink-0 px-2 pb-1 pt-5 text-center text-sm font-bold uppercase tracking-[0.14em] text-white/85 sm:pt-6 sm:text-base'
              : 'shrink-0 px-2 pt-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-white/55 sm:text-sm'
        }
      >
        {kicker}
      </p>
    ) : null}
    <div
      className={
        contentAlign === 'readable'
          ? 'flex min-h-0 flex-1 flex-col items-stretch justify-start overflow-y-auto px-4 py-6 text-left'
          : 'flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-8 text-center'
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
