import { useEffect } from 'react';

let debounceId = 0;

/** Стабильная высота: без клавиатуры — window.innerHeight (Telegram иногда шлёт половину экрана на переходах). */
function syncAppViewport() {
  const inner = window.innerHeight;
  const vv = window.visualViewport;
  const vvH = vv?.height ?? inner;
  const keyboardOpen = vvH < inner * 0.72;
  const height = keyboardOpen ? vvH : inner;

  document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--app-offset-top', `${Math.round(vv?.offsetTop ?? 0)}px`);
}

function scheduleSync() {
  window.clearTimeout(debounceId);
  debounceId = window.setTimeout(syncAppViewport, 50);
}

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
