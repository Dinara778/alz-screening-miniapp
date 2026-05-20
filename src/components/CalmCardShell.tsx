import type { ElementType, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Растянуть на высоту экрана */
  fill?: boolean;
  overflowVisible?: boolean;
  as?: ElementType;
  'aria-label'?: string;
};

/** Карточка с зелёным градиентом (как intro-экран 3) */
export const CalmCardShell = ({
  children,
  className = '',
  innerClassName = '',
  fill = false,
  overflowVisible = false,
  as: Tag = 'div',
  'aria-label': ariaLabel,
}: Props) => (
  <Tag
    aria-label={ariaLabel}
    className={`calm-card relative flex w-full flex-col rounded-[1.75rem] sm:rounded-3xl ${
      overflowVisible ? 'overflow-visible' : 'overflow-hidden'
    } ${fill ? 'min-h-0 flex-1' : ''} ${className}`}
  >
    <div className="calm-glow" aria-hidden />
    <div
      className={`relative z-10 flex min-h-0 flex-col ${fill ? 'flex-1' : ''} ${innerClassName}`.trim()}
    >
      {children}
    </div>
  </Tag>
);
