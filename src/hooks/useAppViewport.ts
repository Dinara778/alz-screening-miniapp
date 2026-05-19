import { useEffect } from 'react';

let debounceId = 0;

function syncAppViewport() {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--app-offset-top', `${Math.round(vv?.offsetTop ?? 0)}px`);
}

function scheduleSync() {
  window.clearTimeout(debounceId);
  debounceId = window.setTimeout(syncAppViewport, 80);
}

/** Синхронизирует высоту shell с visualViewport (клавиатура). Без scroll-событий — они давали дёрганье. */
export function useAppViewport() {
  useEffect(() => {
    syncAppViewport();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleSync);
    window.addEventListener('resize', scheduleSync);

    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', scheduleSync);

    return () => {
      window.clearTimeout(debounceId);
      vv?.removeEventListener('resize', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      tg?.offEvent?.('viewportChanged', scheduleSync);
    };
  }, []);
}
