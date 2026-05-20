import { useApp } from '../context/AppContext';

const btnClass =
  'rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10 active:scale-[0.98]';

export const AppRefreshControls = () => {
  const { refreshApp, restartApp } = useApp();

  return (
    <div
      className="mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2"
      role="toolbar"
      aria-label="Обновление приложения"
    >
      <button type="button" className={btnClass} onClick={() => refreshApp()}>
        Обновить
      </button>
      <button type="button" className={btnClass} onClick={() => restartApp()}>
        Начать сначала
      </button>
    </div>
  );
};
