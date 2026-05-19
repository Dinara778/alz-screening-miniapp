export const TELEGRAM_SUPPORT_URL = 'https://t.me/dinarareads';

type Props = { showSupport?: boolean; showDeveloperCredit?: boolean };

export const SupportFooter = ({
  showSupport = true,
  showDeveloperCredit = true,
}: Props) => {
  if (!showSupport && !showDeveloperCredit) return null;

  return (
    <footer className="calm-footer">
      {showSupport ? (
        <div className="mb-3">
          <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Техподдержка
          </a>
          <span className="text-white/30"> · </span>
          <span>Telegram</span>
        </div>
      ) : null}
      {showDeveloperCredit ? (
        <p className="text-xs leading-relaxed">
          © {new Date().getFullYear()} Разработано Corta Lab (ООО «Букволон ИТ Решения»)
        </p>
      ) : null}
    </footer>
  );
};
