import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** true — короткий экран по центру; false — контент сверху со скроллом */
  centerContent?: boolean;
  /** Чуть выше геом. центра (футер с CTA остаётся внизу) */
  liftCenteredContent?: boolean;
  /** false — карточка по высоте контента, скролл снаружи (длинные списки) */
  fillViewport?: boolean;
  /** Весь контент на экран без внутреннего скролла */
  compactFit?: boolean;
  'aria-label'?: string;
};

/** Оболочка intro-экранов — calm tech; CTA внизу */
export const IntroShell = ({
  children,
  footer,
  centerContent = false,
  liftCenteredContent = false,
  fillViewport = true,
  compactFit = false,
  'aria-label': ariaLabel,
}: Props) => {
  const contentAreaClass = !fillViewport
    ? 'w-full shrink-0 pt-0.5'
    : compactFit
      ? 'flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-hidden py-0.5'
      : centerContent
        ? liftCenteredContent
          ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
          : 'flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain py-2'
        : 'flex min-h-0 flex-1 flex-col justify-start overflow-y-auto overscroll-contain py-1';

  return (
    <section
      className={`calm-card relative flex w-full flex-col rounded-[1.75rem] sm:rounded-3xl ${
        fillViewport ? 'min-h-0 flex-1 overflow-hidden' : 'shrink-0 overflow-visible'
      }`}
      aria-label={ariaLabel}
    >
      <div className="calm-glow" aria-hidden />
      <div
        className={`relative z-10 flex flex-col px-5 py-4 sm:px-6 sm:py-5 ${
          fillViewport ? 'min-h-0 flex-1' : ''
        }`}
      >
        {footer ? (
          <>
            <div className={contentAreaClass}>
              {centerContent && liftCenteredContent ? (
                <>
                  <div className="min-h-0 flex-[9] basis-0" aria-hidden />
                  <div className="w-full shrink-0 py-2">{children}</div>
                  <div className="min-h-0 flex-[11] basis-0" aria-hidden />
                </>
              ) : (
                children
              )}
            </div>
            <div
              className={`shrink-0 space-y-3 border-t border-white/10 pt-4 ${
                fillViewport ? 'mt-auto pb-[max(0.25rem,env(safe-area-inset-bottom))]' : 'mt-4 pb-1'
              }`}
            >
              {footer}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">{children}</div>
        )}
      </div>
    </section>
  );
};
