import type { ReactNode } from 'react';
import { SupportFooter } from '../SupportFooter';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
};

/** Оболочка экранов отчёта / upsell: скролл, CTA, техподдержка */
export const ReportFlowShell = ({ children, footer }: Props) => (
  <div className="calm-results flex min-h-0 flex-1 flex-col text-white">
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 py-4 [-webkit-overflow-scrolling:touch]">
      {children}
    </div>
    {footer ? (
      <div className="mt-auto shrink-0 space-y-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4">
        {footer}
      </div>
    ) : null}
    <SupportFooter showDeveloperCredit={false} />
  </div>
);
