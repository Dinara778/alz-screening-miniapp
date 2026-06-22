type Props = {
  className?: string;
};

/** Логотип Corta — надпись без подложки, цвет бренда #14b5a4. */
export const CortaLogo = ({ className = '' }: Props) => (
  <span
    className={`select-none text-[2rem] font-black lowercase leading-none text-[#14b5a4] sm:text-[2.25rem] ${className}`}
    style={{
      fontFamily: 'Nunito, Plus Jakarta Sans, system-ui, sans-serif',
      letterSpacing: '-0.04em',
    }}
    aria-label="Corta"
  >
    corta
  </span>
);
