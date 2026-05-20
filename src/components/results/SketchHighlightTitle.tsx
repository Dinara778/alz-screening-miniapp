import { useId, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Цвет облака / шкалы (как на экране индекса) */
  accent: string;
  className?: string;
  /** Меньше выступ SVG снизу — чтобы обводка не заходила на текст под заголовком */
  tuckBottomOutline?: boolean;
  /** Больше отступ обводки — длинные заголовки на intro-экранах (2+ строк) */
  generousOutline?: boolean;
};

/** Небрежная ручная обводка вокруг заголовка интерпретации */
export const SketchHighlightTitle = ({
  children,
  accent,
  className = '',
  tuckBottomOutline = false,
  generousOutline = false,
}: Props) => {
  const uid = useId().replace(/:/g, '');
  const relaxed = generousOutline && !tuckBottomOutline;

  return (
    <h2
      className={`relative mb-1 max-w-full text-left ${
        relaxed ? 'inline-block w-fit max-w-full' : 'inline-block'
      } ${className}`}
    >
      <svg
        className={`pointer-events-none absolute overflow-visible ${
          relaxed
            ? '-left-4 -right-4 -top-3 -bottom-3 h-[calc(100%+1.5rem)] w-[calc(100%+2rem)]'
            : `-left-2.5 -right-2.5 w-[calc(100%+1.25rem)] ${
                tuckBottomOutline ? '-top-1 bottom-1.5' : '-top-1.5 bottom-[-0.25rem]'
              }`
        }`}
        viewBox={relaxed ? '0 0 280 96' : '0 0 280 64'}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <filter
            id={`${uid}-glow`}
            x={relaxed ? '-20%' : '-15%'}
            y={relaxed ? '-32%' : '-25%'}
            width={relaxed ? '140%' : '130%'}
            height={relaxed ? '170%' : '150%'}
          >
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M12 22 C16 10 48 6 88 12 L228 14 C252 12 264 22 262 36 C260 50 244 56 220 54 L72 52 C36 56 10 48 12 30 C10 24 8 22 12 22 Z"
          fill={accent}
          fillOpacity="0.1"
          stroke={accent}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
          filter={`url(#${uid}-glow)`}
        />
        <path
          d="M14 24 C20 14 52 12 90 16 L224 18 C246 16 256 26 254 38 C252 48 238 52 216 50 L74 48 C40 52 16 44 14 28 Z"
          fill="none"
          stroke={accent}
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      </svg>
      <span
        className={`app-heading relative z-10 block leading-snug ${
          relaxed ? 'px-3 py-2.5 sm:px-3.5 sm:py-3' : 'px-0.5 py-1'
        }`}
      >
        {children}
      </span>
    </h2>
  );
};
