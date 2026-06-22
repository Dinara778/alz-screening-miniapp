type Props = {
  className?: string;
};

/** Логотип Corta — надпись как в бренд-файле (#14b5a4), без фона. */
export const CortaLogo = ({ className = '' }: Props) => (
  <span
    className={`select-none text-[1.35rem] font-black lowercase text-[#14b5a4] sm:text-[1.5rem] ${className}`}
    style={{
      fontFamily: 'Nunito, Plus Jakarta Sans, system-ui, sans-serif',
      letterSpacing: '-0.04em',
    }}
    aria-label="Corta"
  >
    corta
  </span>
);
