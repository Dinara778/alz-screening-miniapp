export const TELEGRAM_SUPPORT_URL = 'https://t.me/dinarareads';

type Props = { showSupport?: boolean; showDeveloperCredit?: boolean };

export const SupportFooter = ({
  showSupport = true,
  showDeveloperCredit = true,
}: Props) => {
  if (!showSupport && !showDeveloperCredit) return null;

  return (
    <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
      {showSupport ? (
        <div className="mb-3">
          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-900 underline decoration-emerald-700/50 underline-offset-2 hover:text-emerald-950"
          >
            Техподдержка
          </a>
          <span className="text-slate-400"> · </span>
          <span className="text-slate-500">Telegram</span>
        </div>
      ) : null}
      {showDeveloperCredit ? (
        <p className="text-xs text-slate-500 leading-relaxed">
          © {new Date().getFullYear()} Разработано Corta Lab (ООО «Букволон ИТ Решения»)
        </p>
      ) : null}
    </footer>
  );
};
