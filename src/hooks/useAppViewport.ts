import { useEffect } from 'react';

let debounceId = 0;

/**
 * Высота под реальную видимую область (Instagram/Telegram chrome, клавиатура).
 * Telegram иногда кратковременно отдаёт ~половину экрана — такие значения игнорируем.
 */
function syncAppViewport() {
  const inner = window.innerHeight;
  const vv = window.visualViewport;
  const vvH = vv?.height ?? inner;
  const ratio = vvH / Math.max(inner, 1);

  const active = document.activeElement as HTMLElement | null;
  const typing =
    active?.tagName === 'INPUT' ||
    active?.tagName === 'TEXTAREA' ||
    active?.isContentEditable === true;

  let height = inner;
  if (ratio >= 0.85) {
    // Обычный случай: vv чуть меньше из‑за тулбара / URL bar — берём видимое.
    height = Math.min(inner, vvH);
  } else if (ratio < 0.72 || typing) {
    // Клавиатура или явный resize.
    height = vvH;
  }
  // 0.72–0.85 без фокуса в поле: вероятный глюк TG → оставляем inner.

  document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
  document.documentElement.style.setProperty(
    '--app-offset-top',
    `${Math.round(vv?.offsetTop ?? 0)}px`,
  );
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
    vv?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('orientationchange', scheduleSync);

    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', scheduleSync);

    return () => {
      window.clearTimeout(debounceId);
      vv?.removeEventListener('resize', scheduleSync);
      vv?.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
      tg?.offEvent?.('viewportChanged', scheduleSync);
    };
  }, []);
}
