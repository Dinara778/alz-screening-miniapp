import { useId, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Цвет облака / шкалы (как на экране индекса) */
  accent: string;
  className?: string;
  /** Меньше выступ SVG снизу — чтобы обводка не заходила на текст под заголовком */
  tuckBottomOutline?: boolean;
  /** Больше отступ обводки — длинные заголовки на intro-экранах */
  generousOutline?: boolean;
  /** Высокая обводка под 3 строки заголовка */
  threeLineOutline?: boolean;
};

/** Небрежная ручная обводка вокруг заголовка интерпретации */
export const SketchHighlightTitle = ({
  children,
  accent,
  className = '',
  tuckBottomOutline = false,
  generousOutline = false,
  threeLineOutline = false,
}: Props) => {
  const uid = useId().replace(/:/g, '');
  const relaxed = generousOutline && !tuckBottomOutline;
  const tall = threeLineOutline && relaxed;

  return (
    <h2
      className={`relative mb-1 max-w-full text-left ${
        relaxed ? 'block w-full' : 'inline-block'
      } ${className}`}
    >
      <svg
        className={`pointer-events-none absolute overflow-visible ${
          tall
            ? '-left-4 -right-4 w-[calc(100%+2rem)] -top-3 -bottom-3'
            : relaxed
              ? '-left-4 -right-4 w-[calc(100%+2rem)] -top-3 bottom-2'
              : `-left-2.5 -right-2.5 w-[calc(100%+1.25rem)] ${
                  tuckBottomOutline ? '-top-1 bottom-1.5' : '-top-1.5 bottom-[-0.25rem]'
                }`
        }`}
        viewBox={tall ? '0 0 280 120' : relaxed ? '0 0 280 88' : '0 0 280 64'}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <filter
            id={`${uid}-glow`}
            x={tall ? '-22%' : relaxed ? '-20%' : '-15%'}
            y={tall ? '-35%' : relaxed ? '-30%' : '-25%'}
            width={tall ? '145%' : relaxed ? '140%' : '130%'}
            height={tall ? '175%' : relaxed ? '165%' : '150%'}
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
          tall ? 'px-3 py-3 sm:px-4 sm:py-3.5' : relaxed ? 'px-3 py-2.5 sm:px-3.5 sm:py-3' : 'px-0.5 py-1'
        }`}
      >
        {children}
      </span>
    </h2>
  );
};
