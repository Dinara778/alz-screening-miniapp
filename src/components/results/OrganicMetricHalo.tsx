import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** CSS color for glow stroke */
  accent?: string;
};

/** Органический «живой» контур вокруг главной метрики (calm tech / premium). */
export const OrganicMetricHalo = ({ children, accent = '#2dd4bf' }: Props) => {
  const id = 'metric-halo';
  return (
    <div className="relative mx-auto flex aspect-square w-[min(78vw,300px)] items-center justify-center">
      <svg className="metric-halo-spin absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.04" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="72" fill={`url(#${id}-fill)`} />
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const r = 68 + (i % 3) * 4;
          const x = 100 + Math.cos(a) * r;
          const y = 100 + Math.sin(a) * r;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={0.9 + (i % 2) * 0.4}
              fill={accent}
              opacity={0.15 + (i % 5) * 0.08}
            />
          );
        })}
        <path
          className="metric-halo-pulse"
          d="M100 28 C132 30 158 52 168 84 C176 112 162 142 136 158 C112 172 84 170 62 154 C38 136 28 108 34 78 C40 50 68 26 100 28 Z"
          fill="none"
          stroke={accent}
          strokeWidth="1.25"
          strokeLinecap="round"
          filter={`url(#${id}-glow)`}
          opacity="0.85"
        />
        <path
          className="metric-halo-pulse metric-halo-pulse-delay"
          d="M100 36 C124 38 146 56 152 82 C158 106 146 132 122 146 C100 158 74 156 56 140 C40 124 36 98 44 74 C52 50 74 34 100 36 Z"
          fill="none"
          stroke={accent}
          strokeWidth="0.75"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};
