import { useCabinetSession } from '../utils/cabinetApi';

type Props = {
  className?: string;
  variant?: 'link' | 'button';
};

export const CabinetAccessLink = ({ className = '', variant = 'link' }: Props) => {
  const { accessToken, email, ready, configured } = useCabinetSession();

  if (!ready || !configured) return null;

  const loggedIn = Boolean(accessToken && email);
  const label = loggedIn ? email! : 'Войти';
  const baseClass =
    variant === 'button' ? 'cabinet-access-btn' : 'cabinet-access-link';

  return (
    <a
      href="/cabinet"
      className={`${baseClass}${className ? ` ${className}` : ''}`}
      title={loggedIn ? 'Личный кабинет' : 'Войти в личный кабинет'}
    >
      {label}
    </a>
  );
};
