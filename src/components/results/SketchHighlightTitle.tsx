import { useId, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Цвет облака / шкалы (как на экране индекса) */
  accent: string;
  className?: string;
};

/** Небрежная ручная обводка вокруг заголовка интерпретации */
export const SketchHighlightTitle = ({ children, accent, className = '' }: Props) => {
  const uid = useId().replace(/:/g, '');

  return (
    <h2 className={`relative mb-1 inline-block max-w-full text-left ${className}`}>
      <svg
        className="pointer-events-none absolute -left-2.5 -right-2.5 -top-1.5 bottom-[-0.25rem] w-[calc(100%+1.25rem)] overflow-visible"
        viewBox="0 0 280 64"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <filter id={`${uid}-glow`} x="-15%" y="-25%" width="130%" height="150%">
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
      <span className="app-heading relative z-10 block px-0.5 py-1 leading-snug">{children}</span>
    </h2>
  );
};
