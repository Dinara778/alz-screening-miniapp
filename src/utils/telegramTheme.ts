/** Подстраивает CSS-переменные и класс `dark` под тему Telegram Mini App.
 * На Android иногда `colorScheme === 'dark'` при светлом `bg_color` — тогда включался светлый текст
 * на светлом фоне. Решение: ориентироваться на яркость `themeParams.bg_color`, если она есть. */

function parseHexRgb(input: string | undefined): [number, number, number] | null {
  if (!input || typeof input !== 'string') return null;
  let h = input.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Относительная яркость (WCAG), 0 — чёрный, 1 — белый */
function channelLuminance(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type TgWebApp = NonNullable<NonNullable<Window['Telegram']>['WebApp']>;

function inferDarkUiFromTheme(tg: TgWebApp): boolean {
  const tp = tg.themeParams ?? {};
  const candidates = [tp.bg_color, tp.secondary_bg_color].filter(Boolean) as string[];
  for (const hex of candidates) {
    const rgb = parseHexRgb(hex);
    if (!rgb) continue;
    const L = relativeLuminance(rgb);
    if (L > 0.62) return false;
    if (L < 0.4) return true;
  }
  return tg.colorScheme === 'dark';
}

/** Подстраивает CSS-переменные под тему Telegram Mini App. */
export const applyTelegramTheme = (): void => {
  const tg = window.Telegram?.WebApp;
  const r = document.documentElement;
  if (!tg) return;

  const useDarkUi = inferDarkUiFromTheme(tg);
  const tp = tg.themeParams;

  if (tp) {
    const { bg_color, text_color, hint_color, link_color, secondary_bg_color } = tp;
    if (bg_color) r.style.setProperty('--tg-theme-bg-color', bg_color);
    if (text_color) r.style.setProperty('--tg-theme-text-color', text_color);
    if (hint_color) r.style.setProperty('--tg-theme-hint-color', hint_color);
    if (link_color) r.style.setProperty('--tg-theme-link-color', link_color);
    if (secondary_bg_color) r.style.setProperty('--tg-theme-secondary-bg-color', secondary_bg_color);
  }

  if (useDarkUi) {
    r.classList.add('telegram-dark', 'dark');
  } else {
    r.classList.remove('telegram-dark', 'dark');
  }
};

/** Подписка на смену темы (важно для Android: параметры приходят после первого кадра). */
export const attachTelegramThemeListener = (): (() => void) => {
  const tg = window.Telegram?.WebApp;
  if (!tg?.onEvent) return () => {};

  const onTheme = () => {
    applyTelegramTheme();
  };
  tg.onEvent('themeChanged', onTheme);
  return () => tg.offEvent?.('themeChanged', onTheme);
};
