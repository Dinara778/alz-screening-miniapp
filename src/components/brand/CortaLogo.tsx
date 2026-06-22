import { publicAsset } from '../../utils/publicAsset';

type Props = {
  className?: string;
};

/** Логотип Corta — PNG из бренд-файла, без фона. */
export const CortaLogo = ({ className = '' }: Props) => (
  <img
    src={publicAsset('/corta-logo-mark.png')}
    alt="Corta"
    width={104}
    height={28}
    className={`h-7 w-auto max-w-[260px] select-none sm:h-8 ${className}`}
    draggable={false}
  />
);
