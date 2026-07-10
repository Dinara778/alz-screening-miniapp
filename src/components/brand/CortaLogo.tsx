type Props = {
  className?: string;
};

/** Логотип Corta daily — Nunito, как раньше: corta + daily строкой ниже. */
export const CortaLogo = ({ className = '' }: Props) => (
  <span
    className={`select-none inline-flex flex-col leading-none lowercase text-[#14b5a4] ${className}`}
    style={{
      fontFamily: 'Nunito, Plus Jakarta Sans, system-ui, sans-serif',
      letterSpacing: '-0.04em',
    }}
    aria-label="Corta daily"
  >
    <span className="text-[2rem] font-black sm:text-[2.25rem]">corta</span>
    <span
      className="mt-[-0.22em] text-[1.2rem] font-black sm:text-[1.3rem]"
      style={{ transform: 'translateX(0.42em)' }}
    >
      daily
    </span>
  </span>
);
