type Props = {
  value: number;
  max?: number;
  accent?: string;
  size?: number;
};

/** Кольцо с заполнением пропорционально значению (0–max). */
export const ScoreRing = ({ value, max = 100, accent = '#2dd4bf', size = 260 }: Props) => {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? clamped / max : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="absolute inset-0 m-auto block h-full w-full"
      role="img"
      aria-label={`${Math.round(clamped)} из ${max}`}
    >
      <defs>
        <linearGradient id="score-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3.5"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="url(#score-ring-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
};
