import { TELEGRAM_SUPPORT_URL } from './SupportFooter';

export const Footer = () => (
  <>
    <hr className="mt-6 border-0 border-t border-slate-200" />
    <footer className="mt-0 px-4 py-3 flex flex-col items-start text-left text-xs text-gray-500 max-w-2xl mx-auto w-full">
      <div className="mb-2 w-full">
        <span className="inline-block font-medium text-gray-500 border-b border-dotted border-gray-500 cursor-default select-none">
          🧠 Научная основа
        </span>
      </div>
      <div className="mb-2 w-full">
        <div className="font-medium text-gray-600 mb-0.5">🔒 Конфиденциальность</div>
        <p>Все данные хранятся только на вашем устройстве</p>
      </div>
      <div className="mb-2 w-full">
        <div className="font-medium text-gray-600 mb-0.5">📧 По вопросам</div>
        <a
          href="mailto:hello@bookvolon.ru"
          className="text-gray-600 underline underline-offset-2 hover:text-gray-800"
        >
          hello@bookvolon.ru
        </a>
      </div>
      <div className="mb-2 w-full">
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-emerald-900 underline decoration-emerald-700/50 underline-offset-2 hover:text-emerald-950"
        >
          Техподдержка
        </a>
        <span className="text-gray-400"> · </span>
        <span className="text-gray-500">Telegram</span>
      </div>
      <p className="mb-2 w-full text-gray-500 leading-relaxed">
        © {new Date().getFullYear()} Разработано Corta Lab (ООО «Букволон ИТ Решения»)
      </p>
      <div className="text-gray-400">Версия 1.0.0</div>
    </footer>
  </>
);
