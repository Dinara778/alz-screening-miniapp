type Props = {
  className?: string;
};

/** Логотип Corta daily — зонтик CORTA + DAILY строкой ниже. */
export const CortaLogo = ({ className = '' }: Props) => (
  <span
    className={`select-none inline-flex flex-col leading-none ${className}`}
    style={{
      fontFamily: "'Bradley Hand', 'Marker Felt', 'Segoe Print', 'Comic Sans MS', cursive",
      color: '#14b5a4',
      letterSpacing: '-0.04em',
      textTransform: 'uppercase',
    }}
    aria-label="Corta daily"
  >
    <span
      className="text-[2rem] font-black sm:text-[2.25rem]"
      style={{
        transform: 'rotate(-1deg)',
      }}
    >
      CORTA
    </span>
    <span
      className="mt-[-0.28em] text-[1.35rem] font-black sm:text-[1.45rem]"
      style={{
        transform: 'translateX(0.25em) rotate(-0.65deg)',
      }}
    >
      DAILY
    </span>
  </span>
);
