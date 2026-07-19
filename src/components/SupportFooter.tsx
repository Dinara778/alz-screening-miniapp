import { useState } from 'react';
import { CabinetAccessLink } from './CabinetAccessLink';
import { SupportContactSheet } from './SupportContactSheet';
import { SUPPORT_EMAIL } from '../constants/supportContact';

export { TELEGRAM_SUPPORT_URL, SUPPORT_EMAIL } from '../constants/supportContact';

type Props = {
  showSupport?: boolean;
  showDeveloperCredit?: boolean;
  showCabinetAccess?: boolean;
  /** Показывать «пишите на hello@…» рядом с кнопкой */
  showSupportEmailHint?: boolean;
  /** Email анкеты / прохождения — не показывать чужой email из старой сессии кабинета */
  accountEmail?: string | null;
  sessionId?: string | null;
  screen?: string | null;
};

export const SupportFooter = ({
  showSupport = true,
  showDeveloperCredit = true,
  showCabinetAccess = true,
  showSupportEmailHint = true,
  accountEmail = null,
  sessionId = null,
  screen = null,
}: Props) => {
  const [supportOpen, setSupportOpen] = useState(false);

  if (!showSupport && !showDeveloperCredit && !showCabinetAccess) return null;

  return (
    <>
      <footer className="calm-footer">
        {showCabinetAccess ? (
          <div className={showSupport || showDeveloperCredit ? 'mb-3' : ''}>
            <CabinetAccessLink variant="button" expectedEmail={accountEmail} />
          </div>
        ) : null}
        {showSupport ? (
          <div className={showDeveloperCredit ? 'mb-3' : ''}>
            <button
              type="button"
              className="font-medium text-teal-300/90 underline decoration-teal-400/40 underline-offset-2 hover:text-teal-200"
              onClick={() => setSupportOpen(true)}
            >
              Техподдержка
            </button>
            {showSupportEmailHint ? (
              <>
                <span className="text-white/30"> · </span>
                <span>пишите на {SUPPORT_EMAIL}</span>
              </>
            ) : null}
          </div>
        ) : null}
        {showDeveloperCredit ? (
          <p className="text-xs leading-relaxed">
            © {new Date().getFullYear()} Разработано Corta Lab (ООО «Букволон ИТ Решения»)
          </p>
        ) : null}
      </footer>
      <SupportContactSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialEmail={accountEmail}
        sessionId={sessionId}
        screen={screen}
      />
    </>
  );
};
