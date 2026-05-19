import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** true — короткий экран по центру; false — контент сверху со скроллом */
  centerContent?: boolean;
  /** Чуть выше геом. центра (футер с CTA остаётся внизу) */
  liftCenteredContent?: boolean;
  'aria-label'?: string;
};

/** Оболочка intro-экранов — calm tech; CTA внизу */
export const IntroShell = ({
  children,
  footer,
  centerContent = false,
  liftCenteredContent = false,
  'aria-label': ariaLabel,
}: Props) => {
  const contentAreaClass = centerContent
    ? liftCenteredContent
      ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
      : 'flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain py-2'
    : 'flex min-h-0 flex-1 flex-col justify-start overflow-y-auto overscroll-contain py-1';

  return (
    <section
      className="calm-card relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.75rem] sm:rounded-3xl"
      aria-label={ariaLabel}
    >
      <div className="calm-glow" aria-hidden />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 py-4 sm:px-6 sm:py-5">
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
            <div className="mt-auto shrink-0 space-y-3 border-t border-white/10 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
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
