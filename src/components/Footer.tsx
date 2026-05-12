export const Footer = () => (
  <>
    <hr className="mt-6 border-0 border-t border-slate-200" />
    <footer className="mt-0 px-4 py-3 flex flex-col items-center text-xs text-gray-500 max-w-2xl mx-auto w-full">
      <div className="mb-2 text-center max-w-md">
        <div className="font-medium text-gray-600 mb-0.5">🧠 Научная основа</div>
        <p>
          Тест использует методики Flanker, Stroop и отсроченное воспроизведение, апробированные в клинических
          исследованиях.
        </p>
      </div>
      <div className="mb-2 text-center max-w-md">
        <div className="font-medium text-gray-600 mb-0.5">🔒 Конфиденциальность</div>
        <p>Все данные хранятся только на вашем устройстве и не передаются никому.</p>
      </div>
      <div className="mb-2 text-center">
        <div className="font-medium text-gray-600 mb-0.5">📧 По вопросам</div>
        <a href="mailto:hello@bookvolon.ru" className="text-gray-600 underline underline-offset-2 hover:text-gray-800">
          hello@bookvolon.ru
        </a>
      </div>
      <div className="text-center text-gray-400">Версия 1.0.0</div>
    </footer>
  </>
);
