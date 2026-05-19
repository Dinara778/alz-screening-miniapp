import type { ReactNode } from 'react';
import { BackArrowButton } from './BackArrowButton';

type Props = {
  onBack: () => void;
  'aria-label'?: string;
  children?: ReactNode;
  className?: string;
};

/** Строка над контентом: стрелка «назад» всегда выше шкал и карточек */
export const ScreenBackHeader = ({
  onBack,
  'aria-label': ariaLabel,
  children,
  className = '',
}: Props) => (
  <div className={`relative z-50 flex w-full shrink-0 items-center gap-2 ${className}`}>
    <BackArrowButton onClick={onBack} aria-label={ariaLabel} />
    {children ? <div className="min-w-0 flex-1 pt-2">{children}</div> : null}
  </div>
);
