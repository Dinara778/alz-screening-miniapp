import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Основная кнопка (или группа) — всегда внизу экрана */
  footer: ReactNode;
  /** Доп. действие под CTA (например «История») */
  footerExtra?: ReactNode;
  /** start — для полей ввода (меньше скачков при клавиатуре) */
  contentAlign?: 'center' | 'start';
  /** false — карточка по высоте контента (шаги с полями ввода) */
  fill?: boolean;
  className?: string;
};

/**
 * Контент по центру между верхом и CTA; кнопки прижаты к низу с safe-area.
 * Не использовать на экранах тестов (стимул / реакция по центру).
 */
export const ScreenBottomCta = ({
  children,
  footer,
  footerExtra,
  contentAlign = 'center',
  fill = true,
  className = '',
}: Props) => (
  <div className={`flex min-h-0 flex-col ${fill ? 'flex-1' : ''} ${className}`}>
    <div
      className={`flex min-h-0 flex-col overflow-y-auto py-2 ${fill ? 'flex-1' : ''} ${
        contentAlign === 'start' ? 'justify-start' : 'justify-center'
      }`}
    >
      {children}
    </div>
    <div className="mt-auto shrink-0 space-y-3 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {footer}
      {footerExtra}
    </div>
  </div>
);
