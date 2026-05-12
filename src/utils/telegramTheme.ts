/** Подстраивает фон и CSS-переменные под тему Telegram Mini App. */
export const applyTelegramTheme = (): void => {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const r = document.documentElement;
  const tp = tg.themeParams;
  if (tp) {
    const { bg_color, text_color, hint_color, link_color, secondary_bg_color } = tp;
    if (bg_color) {
      r.style.setProperty('--tg-theme-bg-color', bg_color);
      document.body.style.backgroundColor = bg_color;
    }
    if (text_color) r.style.setProperty('--tg-theme-text-color', text_color);
    if (hint_color) r.style.setProperty('--tg-theme-hint-color', hint_color);
    if (link_color) r.style.setProperty('--tg-theme-link-color', link_color);
    if (secondary_bg_color) r.style.setProperty('--tg-theme-secondary-bg-color', secondary_bg_color);
  }
  if (tg.colorScheme === 'dark') {
    r.classList.add('telegram-dark', 'dark');
  } else {
    r.classList.remove('telegram-dark', 'dark');
  }
};
