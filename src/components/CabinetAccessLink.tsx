import { useEffect } from 'react';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { useCabinetSession } from '../utils/cabinetApi';
import { syncCabinetSessionWithEmail } from '../utils/cabinetEmailSync';

type Props = {
  className?: string;
  variant?: 'link' | 'button';
  /** Email текущего прохождения — если не совпадает с кабинетом, показываем «Войти» */
  expectedEmail?: string | null;
};

export const CabinetAccessLink = ({
  className = '',
  variant = 'link',
  expectedEmail = null,
}: Props) => {
  const { accessToken, email, ready, configured, refresh } = useCabinetSession();

  useEffect(() => {
    if (!ready || !expectedEmail) return;
    void syncCabinetSessionWithEmail(expectedEmail).then((signedOut) => {
      if (signedOut) void refresh();
    });
  }, [ready, expectedEmail, refresh]);

  if (!ready || !configured) return null;

  const expected = expectedEmail?.trim().toLowerCase() || null;
  const sessionEmail = email?.trim().toLowerCase() || null;
  const emailMatches = !expected || !sessionEmail || sessionEmail === expected;
  const loggedIn = Boolean(accessToken && sessionEmail && emailMatches);
  const label = loggedIn ? sessionEmail! : 'Войти';
  const baseClass =
    variant === 'button'
      ? `cabinet-access-btn ${CTA_BUTTON_CLASS} transition active:scale-[0.98]`
      : 'cabinet-access-link';

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
