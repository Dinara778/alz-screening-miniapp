import { useRef, type ReactNode } from 'react';
import { SupportFooter } from '../SupportFooter';
import { ReportScrollDownHint } from './ReportScrollDownHint';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Зелёная стрелка «прокрутите вниз» на длинном экране отчёта */
  showScrollHint?: boolean;
};

/** Оболочка экранов отчёта / upsell: скролл, CTA, техподдержка */
export const ReportFlowShell = ({ children, footer, showScrollHint }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
  <div className="calm-results flex min-h-0 flex-1 flex-col text-white">
    <div
      ref={scrollRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 py-4 [-webkit-overflow-scrolling:touch]"
    >
      {children}
    </div>
    {footer ? (
      <div className="mt-auto shrink-0 space-y-2 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3">
        {showScrollHint ? <ReportScrollDownHint scrollRef={scrollRef} /> : null}
        {footer}
      </div>
    ) : null}
    <SupportFooter showDeveloperCredit={false} />
  </div>
  );
};
