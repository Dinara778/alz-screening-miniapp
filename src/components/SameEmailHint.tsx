import { SAME_EMAIL_WARNING } from '../constants/emailHints';

type Props = {
  className?: string;
  /** Показать email из профиля оценки, если известен */
  email?: string | null;
};

export const SameEmailHint = ({ className = '', email }: Props) => {
  const trimmed = email?.trim();
  return (
    <p className={`same-email-hint${className ? ` ${className}` : ''}`} role="note">
      {trimmed ? (
        <>
          <strong>{SAME_EMAIL_WARNING}</strong>
          <span className="same-email-hint-address">Сейчас в оценке: {trimmed}</span>
        </>
      ) : (
        SAME_EMAIL_WARNING
      )}
    </p>
  );
};
