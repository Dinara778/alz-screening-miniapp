import logoMark from '../../assets/corta-logo-mark.png';

type Props = {
  className?: string;
};

/** Логотип Corta — PNG в бандле Vite (обновляется вместе с JS). */
export const CortaLogo = ({ className = '' }: Props) => (
  <img
    src={logoMark}
    alt="Corta"
    width={104}
    height={28}
    className={`h-7 w-auto max-w-[260px] select-none sm:h-8 ${className}`}
    draggable={false}
  />
);
