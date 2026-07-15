import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Основная кнопка (или группа) — всегда внизу экрана */
  footer?: ReactNode;
  /** Доп. действие под CTA (например «История») */
  footerExtra?: ReactNode;
  /** start — для полей ввода (меньше скачков при клавиатуре) */
  contentAlign?: 'center' | 'start';
  /** false — карточка по высоте контента (шаги с полями ввода) */
  fill?: boolean;
  /** CTA сразу под контентом — без пустого поля при открытой клавиатуре */
  stackFooter?: boolean;
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
  stackFooter = false,
  className = '',
}: Props) => {
  const stretch = fill && !stackFooter;
  const hasFooter = footer != null || footerExtra != null;

  return (
    <div className={`flex min-h-0 flex-col ${stretch ? 'flex-1' : ''} ${className}`}>
      <div
        className={`flex flex-col py-2 ${stretch ? 'min-h-0 flex-1 overflow-y-auto' : 'shrink-0'} ${
          stretch && contentAlign === 'start' ? 'justify-start' : stretch ? 'justify-center' : ''
        }`}
      >
        {children}
      </div>
      {hasFooter ? (
        <div
          className={`shrink-0 space-y-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${
            stackFooter ? 'mt-4 pt-0' : 'mt-auto pt-4'
          }`}
        >
          {footer}
          {footerExtra}
        </div>
      ) : null}
    </div>
  );
};
