type IconProps = { className?: string };

export const IconTarget = ({ className = 'h-6 w-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const IconChart = ({ className = 'h-6 w-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 19V5" strokeLinecap="round" />
    <path d="M4 19h16" strokeLinecap="round" />
    <path d="M8 17V11" strokeLinecap="round" />
    <path d="M12 17V7" strokeLinecap="round" />
    <path d="M16 17V13" strokeLinecap="round" />
  </svg>
);

export const IconLock = ({ className = 'h-6 w-6' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
  </svg>
);

export const IconShield = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconClock = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

export const IconBrain = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path
      d="M8.5 4.5a3 3 0 0 0-3 3v1.2a2.5 2.5 0 0 0 0 4.6V14a3 3 0 0 0 3 3h.5M15.5 4.5a3 3 0 0 1 3 3v1.2a2.5 2.5 0 0 1 0 4.6V14a3 3 0 0 1-3 3h-.5M12 4.5v15"
      strokeLinecap="round"
    />
  </svg>
);

export const IconTrend = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 18h16" strokeLinecap="round" />
    <path d="M6 16l4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBulb = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M9 18h6M10 22h4" strokeLinecap="round" />
    <path
      d="M12 3a6 6 0 0 1 4 10.5c-.6.5-1 1.2-1 2h-6c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconArrowRight = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Декоративный мозг с «свечением» для карточки теста */
export const BrainGlowArt = ({ className = '' }: { className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`} aria-hidden>
    <div className="absolute h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
    <div className="absolute h-20 w-20 rounded-full border border-emerald-400/30" />
    <div className="absolute h-24 w-24 rounded-full border border-emerald-500/15" />
    <IconBrain className="relative h-14 w-14 text-emerald-400" />
  </div>
);
