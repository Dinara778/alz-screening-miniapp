import { useId, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  accent?: string;
  emphasis?: boolean;
};

/** Симметричный «пухлый» контур без хвоста — как WHOOP Age blob */
const BLOB_OUTLINE =
  'M100 20 C132 18 172 34 182 68 C190 102 178 148 148 172 C118 192 78 192 52 172 C26 148 12 102 22 64 C32 30 66 20 100 20 Z';

/** Частицы: плотнее у контура, реже к центру */
const BLOB_PARTICLES: ReadonlyArray<{ x: number; y: number; r: number; o: number }> = (() => {
  const pts: { x: number; y: number; r: number; o: number }[] = [];
  const cx = 100;
  const cy = 100;
  const n = 150;
  for (let i = 0; i < n; i++) {
    const angle = i * 2.399963229728653;
    const t = Math.pow((i + 0.5) / n, 0.48);
    const radius = 28 + t * 58;
    pts.push({
      x: cx + Math.cos(angle) * radius * (0.97 + (i % 5) * 0.012),
      y: cy + Math.sin(angle) * radius * (0.98 + (i % 4) * 0.01),
      r: 0.45 + (i % 3) * 0.2 + (t > 0.65 ? 0.15 : 0),
      o: 0.22 + t * 0.45 + (i % 4) * 0.06,
    });
  }
  for (let i = 0; i < 40; i++) {
    const angle = i * 0.92 + 0.3;
    const radius = 72 + (i % 6) * 1.8;
    pts.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 0.5 + (i % 2) * 0.25,
      o: 0.5 + (i % 3) * 0.12,
    });
  }
  return pts;
})();

/** Один неровный контур + облако частиц; метрика строго по центру внутри */
const CloudHalo = ({ children, accent }: { children: ReactNode; accent: string }) => {
  const uid = useId().replace(/:/g, '');

  return (
    <div className="relative mx-auto flex aspect-square w-[min(88vw,340px)] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <filter id={`${uid}-stroke-glow`} x="-55%" y="-55%" width="210%" height="210%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-outer-bloom`} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <clipPath id={`${uid}-blob-clip`}>
            <path d={BLOB_OUTLINE} />
          </clipPath>
          <radialGradient id={`${uid}-bg`} cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.06" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.22" />
          </radialGradient>
        </defs>

        <path d={BLOB_OUTLINE} fill={accent} opacity="0.08" filter={`url(#${uid}-outer-bloom)`} />

        <g clipPath={`url(#${uid}-blob-clip)`}>
          <path d={BLOB_OUTLINE} fill={`url(#${uid}-bg)`} />
          {BLOB_PARTICLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={accent} opacity={p.o} />
          ))}
        </g>

        <path
          className="metric-cloud-pulse"
          d={BLOB_OUTLINE}
          fill="none"
          stroke={accent}
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.95"
          filter={`url(#${uid}-stroke-glow)`}
        />
      </svg>

      <div className="relative z-10 flex max-w-[62%] flex-col items-center justify-center px-4 text-center">
        {children}
      </div>
    </div>
  );
};

/** Органический контур вокруг метрики домена */
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
