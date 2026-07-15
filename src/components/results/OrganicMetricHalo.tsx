import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  ORGANIC_BLOB_PARTICLES,
  ORGANIC_BLOB_PATH_INNER,
  ORGANIC_BLOB_PATH_MAIN,
} from '../../utils/organicBlob';
import { shouldReduceSvgFilters } from '../../utils/deviceHints';

type Props = {
  children: ReactNode;
  accent?: string;
  emphasis?: boolean;
  /** Уже ореол на коротких экранах (главный индекс) */
  compact?: boolean;
};

/** Один неровный волнистый контур + облако частиц; метрика строго по центру внутри */
const CloudHalo = ({
  children,
  accent,
  compact = false,
}: {
  children: ReactNode;
  accent: string;
  compact?: boolean;
}) => {
  const uid = useId().replace(/:/g, '');
  const softGlow = shouldReduceSvgFilters();
  const shellStyle = { '--halo-accent': accent } as CSSProperties;

  return (
    <div
      className={`relative mx-auto flex aspect-square items-center justify-center ${
        compact ? 'w-[min(68vw,260px)]' : 'w-[min(88vw,340px)]'
      } ${softGlow ? 'metric-halo-android-safe' : ''}`}
      style={shellStyle}
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 200 200" aria-hidden>
        <defs>
          {!softGlow ? (
            <>
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
            </>
          ) : null}
          <clipPath id={`${uid}-blob-clip`}>
            <path d={ORGANIC_BLOB_PATH_MAIN} />
          </clipPath>
          <radialGradient id={`${uid}-bg`} cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor={accent} stopOpacity={softGlow ? '0.08' : '0.06'} />
            <stop offset="55%" stopColor={accent} stopOpacity={softGlow ? '0.16' : '0.14'} />
            <stop offset="100%" stopColor={accent} stopOpacity={softGlow ? '0.24' : '0.22'} />
          </radialGradient>
        </defs>

        {softGlow ? (
          <path d={ORGANIC_BLOB_PATH_MAIN} fill={accent} opacity="0.1" />
        ) : (
          <path d={ORGANIC_BLOB_PATH_MAIN} fill={accent} opacity="0.08" filter={`url(#${uid}-outer-bloom)`} />
        )}

        <g clipPath={`url(#${uid}-blob-clip)`}>
          <path d={ORGANIC_BLOB_PATH_MAIN} fill={`url(#${uid}-bg)`} />
          {ORGANIC_BLOB_PARTICLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={accent} opacity={p.o} />
          ))}
        </g>

        <g className={softGlow ? undefined : 'metric-cloud-drift'} style={{ transformOrigin: '100px 100px' }}>
          <path
            d={ORGANIC_BLOB_PATH_INNER}
            fill="none"
            stroke={accent}
            strokeWidth={softGlow ? '1.1' : '1.35'}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.38"
          />
          <path
            className={softGlow ? undefined : 'metric-cloud-pulse'}
            d={ORGANIC_BLOB_PATH_MAIN}
            fill="none"
            stroke={accent}
            strokeWidth={softGlow ? '2' : '2.35'}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.95"
            filter={softGlow ? undefined : `url(#${uid}-stroke-glow)`}
          />
          {!softGlow ? (
            <path
              className="metric-cloud-pulse-delay"
              d={ORGANIC_BLOB_PATH_MAIN}
              fill="none"
              stroke={accent}
              strokeWidth="1.1"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.35"
              transform="translate(100 100) scale(1.045) translate(-100 -100)"
            />
          ) : null}
        </g>
      </svg>

      <div className="relative z-10 flex max-w-[62%] flex-col items-center justify-center px-4 text-center">
        {children}
      </div>
    </div>
  );
};

/** Органический контур вокруг метрики домена */
export const OrganicMetricHalo = ({
  children,
  accent = '#2dd4bf',
  emphasis = false,
  compact = false,
}: Props) => {
  if (emphasis) {
    return (
      <CloudHalo accent={accent} compact={compact}>
        {children}
      </CloudHalo>
    );
  }

  const id = 'metric-halo';
  const softGlow = shouldReduceSvgFilters();
  const shellStyle = { '--halo-accent': accent } as CSSProperties;

  return (
    <div
      className={`relative mx-auto flex aspect-square w-[min(78vw,300px)] items-center justify-center ${
        softGlow ? 'metric-halo-android-safe' : ''
      }`}
      style={shellStyle}
    >
      <svg
        className={`absolute inset-0 h-full w-full overflow-visible ${softGlow ? '' : 'metric-halo-spin'}`}
        viewBox="0 0 200 200"
        aria-hidden
      >
        <defs>
          {!softGlow ? (
            <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
          <radialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={ORGANIC_BLOB_PATH_MAIN} fill={`url(#${id}-fill)`} opacity="0.85" />
        <path
          className={softGlow ? undefined : 'metric-halo-pulse'}
          d={ORGANIC_BLOB_PATH_INNER}
          fill="none"
          stroke={accent}
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          className={softGlow ? undefined : 'metric-halo-pulse-delay'}
          d={ORGANIC_BLOB_PATH_MAIN}
          fill="none"
          stroke={accent}
          strokeWidth="1.25"
          strokeLinecap="round"
          filter={softGlow ? undefined : `url(#${id}-glow)`}
          opacity="0.85"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};
