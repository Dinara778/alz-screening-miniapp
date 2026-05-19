import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  accent?: string;
  emphasis?: boolean;
};

/** Пухлое «облако» (органический контур, не окружности) — как на референсе WHOOP */
const CLOUD_OUTER =
  'M100 14 C142 12 182 36 192 78 C198 108 188 152 158 178 C128 198 82 202 52 180 C26 158 10 118 18 78 C28 42 58 18 100 14 Z';

const CLOUD_MID =
  'M100 24 C132 22 162 40 170 72 C176 102 166 138 140 158 C114 174 78 176 54 158 C32 138 24 104 32 74 C42 46 68 28 100 24 Z';

/** Точки внутри облака (viewBox 0 0 200 200) */
const CLOUD_PARTICLES: ReadonlyArray<{ x: number; y: number; r: number; o: number }> = [
  { x: 88, y: 52, r: 1.1, o: 0.55 },
  { x: 102, y: 48, r: 0.9, o: 0.45 },
  { x: 118, y: 58, r: 1.2, o: 0.5 },
  { x: 132, y: 72, r: 1, o: 0.4 },
  { x: 142, y: 88, r: 1.3, o: 0.55 },
  { x: 148, y: 108, r: 0.85, o: 0.35 },
  { x: 140, y: 128, r: 1.15, o: 0.5 },
  { x: 124, y: 142, r: 1, o: 0.45 },
  { x: 108, y: 152, r: 1.25, o: 0.55 },
  { x: 92, y: 156, r: 0.9, o: 0.4 },
  { x: 76, y: 150, r: 1.1, o: 0.5 },
  { x: 62, y: 138, r: 1, o: 0.45 },
  { x: 52, y: 120, r: 1.2, o: 0.5 },
  { x: 48, y: 100, r: 0.95, o: 0.4 },
  { x: 54, y: 80, r: 1.15, o: 0.5 },
  { x: 66, y: 64, r: 1, o: 0.45 },
  { x: 78, y: 54, r: 0.8, o: 0.35 },
  { x: 96, y: 68, r: 1.3, o: 0.6 },
  { x: 112, y: 82, r: 1, o: 0.5 },
  { x: 104, y: 102, r: 1.2, o: 0.55 },
  { x: 88, y: 112, r: 0.9, o: 0.45 },
  { x: 72, y: 108, r: 1.1, o: 0.5 },
  { x: 68, y: 92, r: 1, o: 0.4 },
  { x: 82, y: 78, r: 1.15, o: 0.5 },
  { x: 100, y: 88, r: 1.4, o: 0.65 },
  { x: 118, y: 98, r: 1, o: 0.45 },
  { x: 128, y: 118, r: 0.85, o: 0.4 },
  { x: 114, y: 132, r: 1.1, o: 0.5 },
  { x: 98, y: 140, r: 1, o: 0.45 },
  { x: 84, y: 132, r: 1.2, o: 0.55 },
  { x: 74, y: 118, r: 0.9, o: 0.4 },
  { x: 80, y: 98, r: 1, o: 0.45 },
  { x: 94, y: 58, r: 0.75, o: 0.35 },
  { x: 108, y: 62, r: 1.05, o: 0.5 },
  { x: 122, y: 108, r: 0.9, o: 0.4 },
  { x: 58, y: 108, r: 1, o: 0.45 },
  { x: 136, y: 96, r: 1.15, o: 0.5 },
  { x: 90, y: 124, r: 0.85, o: 0.38 },
  { x: 106, y: 118, r: 1, o: 0.42 },
  { x: 100, y: 72, r: 1.5, o: 0.7 },
  { x: 92, y: 96, r: 0.7, o: 0.3 },
  { x: 108, y: 92, r: 0.8, o: 0.32 },
  { x: 64, y: 82, r: 0.9, o: 0.4 },
  { x: 146, y: 112, r: 0.75, o: 0.35 },
  { x: 56, y: 96, r: 1.05, o: 0.48 },
];

const CloudHalo = ({ children, accent }: { children: ReactNode; accent: string }) => {
  const id = 'metric-cloud';
  return (
    <div className="relative mx-auto flex aspect-square w-[min(92vw,360px)] items-center justify-center">
      <svg className="metric-cloud-drift absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="12" result="b" />
            <feMerge>
              <feMergeNode in="b" />
            </feMerge>
          </filter>
          <clipPath id={`${id}-clip`}>
            <path d={CLOUD_OUTER} />
          </clipPath>
          <radialGradient id={`${id}-glow-fill`} cx="50%" cy="48%" r="52%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* мягкое свечение сзади */}
        <path d={CLOUD_OUTER} fill={accent} opacity="0.12" filter={`url(#${id}-soft)`} />

        <g clipPath={`url(#${id}-clip)`}>
          <path d={CLOUD_OUTER} fill={`url(#${id}-glow-fill)`} />
          {CLOUD_PARTICLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={accent} opacity={p.o} />
          ))}
          {/* дополнительные мелкие точки */}
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const dist = 28 + (i % 9) * 7 + ((i * 3) % 5);
            const x = 100 + Math.cos(a + i * 0.4) * dist * (0.85 + (i % 4) * 0.05);
            const y = 100 + Math.sin(a + i * 0.35) * dist * (0.9 + (i % 3) * 0.06);
            return (
              <circle
                key={`d-${i}`}
                cx={x}
                cy={y}
                r={0.45 + (i % 3) * 0.25}
                fill={accent}
                opacity={0.2 + (i % 4) * 0.12}
              />
            );
          })}
        </g>

        {/* пухлый контур облака */}
        <path
          className="metric-cloud-pulse"
          d={CLOUD_OUTER}
          fill="none"
          stroke={accent}
          strokeWidth="2.75"
          strokeLinejoin="round"
          filter={`url(#${id}-glow)`}
          opacity="0.92"
        />
        <path
          className="metric-cloud-pulse metric-cloud-pulse-delay"
          d={CLOUD_MID}
          fill="none"
          stroke={accent}
          strokeWidth="1.25"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

/** Органический контур вокруг главной метрики */
export const OrganicMetricHalo = ({ children, accent = '#2dd4bf', emphasis = false }: Props) => {
  if (emphasis) {
    return <CloudHalo accent={accent}>{children}</CloudHalo>;
  }

  const id = 'metric-halo';
  return (
    <div className="relative mx-auto flex aspect-square w-[min(78vw,300px)] items-center justify-center">
      <svg className="metric-halo-spin absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="72" fill={`url(#${id}-fill)`} />
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
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};
