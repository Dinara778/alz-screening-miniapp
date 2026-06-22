/** Подгружает telegram-web-app.js только в WebView Telegram (не в обычном браузере). */
export function ensureTelegramWebAppScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Telegram?.WebApp) return Promise.resolve();

  const ua = navigator.userAgent || '';
  const inTelegram =
    /Telegram/i.test(ua) ||
    window.location.search.includes('tgWebApp') ||
    window.location.hash.includes('tgWebApp');

  if (!inTelegram) return Promise.resolve();
  if (document.querySelector('script[data-tg-webapp]')) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.dataset.tgWebapp = '1';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}
