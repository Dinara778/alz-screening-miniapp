type Props = {
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
};

/** Стрелка «назад» в левом верхнем углу экрана (calm tech). */
export const BackArrowButton = ({
  onClick,
  disabled = false,
  'aria-label': ariaLabel = 'Назад',
  className = '',
}: Props) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`relative z-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0a0e0d]/90 text-white/90 shadow-lg backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30 ${className}`}
  >
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);
