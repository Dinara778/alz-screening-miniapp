import type { ReactNode } from 'react';
import { BackArrowButton } from './BackArrowButton';

type Props = {
  onBack: () => void;
  'aria-label'?: string;
  children?: ReactNode;
};

/** Строка над контентом: стрелка «назад» всегда выше шкал и карточек */
export const ScreenBackHeader = ({ onBack, 'aria-label': ariaLabel, children }: Props) => (
  <div className="relative z-50 mb-3 flex min-h-11 w-full shrink-0 items-start gap-2">
    <BackArrowButton onClick={onBack} aria-label={ariaLabel} />
    {children ? <div className="min-w-0 flex-1 pt-2">{children}</div> : null}
  </div>
);
