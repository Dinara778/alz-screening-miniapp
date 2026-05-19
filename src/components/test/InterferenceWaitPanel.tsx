import { useId } from 'react';

type Props = {
  remainingSec: number;
  totalSec: number;
};

/** Ожидание до отсроченного воспроизведения — как раньше, таймер в заполняющемся кольце */
export const InterferenceWaitPanel = ({ remainingSec, totalSec }: Props) => {
  const gradId = useId().replace(/:/g, '');
  const elapsed = Math.max(0, totalSec - remainingSec);
  const pct = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="calm-inset space-y-5 p-6 text-center">
      <h2 className="app-heading">Ожидание до отсроченного воспроизведения</h2>
      <div
        className="interference-countdown-ring relative mx-auto flex h-[min(48vw,11.5rem)] w-[min(48vw,11.5rem)] items-center justify-center sm:h-48 sm:w-48"
        role="timer"
        aria-live="polite"
        aria-label={`Осталось ${remainingSec} секунд`}
      >
        <div className="interference-countdown-glow pointer-events-none absolute inset-[-8%] rounded-full" aria-hidden />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={`iw-grad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5eead4" stopOpacity="1" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={`url(#iw-grad-${gradId})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="relative text-[clamp(2.5rem,12vw,3.5rem)] font-semibold tabular-nums leading-none text-teal-300">
          {remainingSec}
        </span>
      </div>
    </div>
  );
};
