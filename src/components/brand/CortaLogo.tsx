type Props = {
  className?: string;
};

/** Логотип Corta daily — corta (Nunito) + daily (Caveat) справа внизу. */
export const CortaLogo = ({ className = '' }: Props) => (
  <span
    className={`select-none inline-flex flex-col items-end leading-none text-[#14b5a4] ${className}`}
    aria-label="Corta daily"
  >
    <span
      className="text-[2rem] font-black lowercase sm:text-[2.25rem]"
      style={{
        fontFamily: 'Nunito, Plus Jakarta Sans, system-ui, sans-serif',
        letterSpacing: '-0.04em',
      }}
    >
      corta
    </span>
    <span className="font-signature -mt-1 pr-0.5 text-[1.45rem] font-semibold lowercase leading-none sm:text-[1.55rem]">
      daily
    </span>
  </span>
);
