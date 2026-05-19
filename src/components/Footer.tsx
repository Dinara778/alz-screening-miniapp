import { TELEGRAM_SUPPORT_URL } from './SupportFooter';

type Props = { compact?: boolean };

export const Footer = ({ compact = false }: Props) => {
  if (compact) {
    return (
      <footer className="calm-footer mt-0 space-y-1.5 px-1 py-1 text-left text-[0.6875rem] leading-snug">
        <p className="text-white/45">
          Данные обрабатываются в соответствии с политикой конфиденциальности.
        </p>
        <p className="text-white/55">
          <a href="mailto:hello@bookvolon.ru" className="text-teal-300/90 underline underline-offset-2">
            hello@bookvolon.ru
          </a>
          <span className="text-white/30"> · </span>
          <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Техподдержка
          </a>
          <span className="text-white/30"> · </span>
          <span className="text-white/35">© {new Date().getFullYear()} Corta Lab</span>
        </p>
      </footer>
    );
  }

  return (
    <>
      <hr className="mt-6 border-0 border-t border-white/10" />
      <footer className="calm-footer mt-0 flex w-full max-w-2xl flex-col items-start px-4 py-3 text-left text-xs">
        <div className="mb-2 w-full">
          <span className="inline-block cursor-default select-none border-b border-dotted border-white/30 font-medium text-white/50">
            🧠 Научная основа
          </span>
        </div>
        <div className="mb-2 w-full">
          <div className="mb-0.5 font-medium text-white/60">🔒 Конфиденциальность</div>
          <p className="text-white/45">Данные обрабатываются в соответствии с политикой конфиденциальности</p>
        </div>
        <div className="mb-2 w-full">
          <div className="mb-0.5 font-medium text-white/60">📧 По вопросам</div>
          <a
            href="mailto:hello@bookvolon.ru"
            className="text-teal-300/90 underline underline-offset-2 hover:text-teal-200"
          >
            hello@bookvolon.ru
          </a>
        </div>
        <div className="mb-2 w-full">
          <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Техподдержка
          </a>
          <span className="text-white/30"> · </span>
          <span>Telegram</span>
        </div>
        <p className="mb-2 w-full leading-relaxed text-white/45">
          © {new Date().getFullYear()} Разработано Corta Lab (ООО «Букволон ИТ Решения»)
        </p>
        <div className="text-white/35">Версия 1.0.0</div>
      </footer>
    </>
  );
};
