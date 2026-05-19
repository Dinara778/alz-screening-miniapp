import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Основная кнопка (или группа) — всегда внизу экрана */
  footer: ReactNode;
  /** Доп. действие под CTA (например «История») */
  footerExtra?: ReactNode;
  className?: string;
};

/**
 * Контент по центру между верхом и CTA; кнопки прижаты к низу с safe-area.
 * Не использовать на экранах тестов (стимул / реакция по центру).
 */
export const ScreenBottomCta = ({ children, footer, footerExtra, className = '' }: Props) => (
  <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-2">{children}</div>
    <div className="mt-auto shrink-0 space-y-3 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {footer}
      {footerExtra}
    </div>
  </div>
);
