import { useEffect } from 'react';

function syncAppViewport() {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--app-offset-top', `${Math.round(offsetTop)}px`);
}

/** Синхронизирует высоту shell с visualViewport (клавиатура iOS / Telegram). */
export function useAppViewport() {
  useEffect(() => {
    syncAppViewport();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncAppViewport);
    vv?.addEventListener('scroll', syncAppViewport);
    window.addEventListener('resize', syncAppViewport);

    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', syncAppViewport);

    return () => {
      vv?.removeEventListener('resize', syncAppViewport);
      vv?.removeEventListener('scroll', syncAppViewport);
      window.removeEventListener('resize', syncAppViewport);
      tg?.offEvent?.('viewportChanged', syncAppViewport);
    };
  }, []);
}
