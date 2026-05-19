import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** CSS color for glow stroke */
  accent?: string;
  /** Крупное кольцо и облако (главный экран индекса) */
  emphasis?: boolean;
};

/** Органический «живой» контур вокруг главной метрики (calm tech / premium). */
export const OrganicMetricHalo = ({ children, accent = '#2dd4bf', emphasis = false }: Props) => {
  const id = 'metric-halo';
  const ringR = emphasis ? 82 : 72;
  const ringStroke = emphasis ? 4.5 : 2.5;
  const outerStroke = emphasis ? 2.75 : 1.25;
  const innerStroke = emphasis ? 1.75 : 0.75;
  const blur = emphasis ? 6 : 3;
  const fillCenterOpacity = emphasis ? 0.28 : 0.14;
  const particleR = emphasis ? 1.35 : 0.9;

  return (
    <div
      className={`relative mx-auto flex aspect-square items-center justify-center ${
        emphasis ? 'w-[min(88vw,340px)]' : 'w-[min(78vw,300px)]'
      }`}
    >
      <svg className="metric-halo-spin absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity={fillCenterOpacity} />
            <stop offset="55%" stopColor={accent} stopOpacity={emphasis ? 0.12 : 0.06} />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r={emphasis ? 92 : 72} fill={`url(#${id}-fill)`} />
        {Array.from({ length: emphasis ? 56 : 48 }, (_, i) => {
          const a = (i / (emphasis ? 56 : 48)) * Math.PI * 2;
          const r = (emphasis ? 74 : 68) + (i % 3) * (emphasis ? 5 : 4);
          const x = 100 + Math.cos(a) * r;
          const y = 100 + Math.sin(a) * r;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={particleR + (i % 2) * (emphasis ? 0.55 : 0.4)}
              fill={accent}
              opacity={0.18 + (i % 5) * (emphasis ? 0.1 : 0.08)}
            />
          );
        })}
        <circle
          cx="100"
          cy="100"
          r={ringR}
          fill="none"
          stroke={accent}
          strokeWidth={ringStroke}
          filter={`url(#${id}-glow)`}
          opacity={emphasis ? 0.95 : 0.75}
        />
        <path
          className="metric-halo-pulse"
          d="M100 28 C132 30 158 52 168 84 C176 112 162 142 136 158 C112 172 84 170 62 154 C38 136 28 108 34 78 C40 50 68 26 100 28 Z"
          fill="none"
          stroke={accent}
          strokeWidth={outerStroke}
          strokeLinecap="round"
          filter={`url(#${id}-glow)`}
          opacity="0.9"
        />
        <path
          className="metric-halo-pulse metric-halo-pulse-delay"
          d="M100 36 C124 38 146 56 152 82 C158 106 146 132 122 146 C100 158 74 156 56 140 C40 124 36 98 44 74 C52 50 74 34 100 36 Z"
          fill="none"
          stroke={accent}
          strokeWidth={innerStroke}
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};
