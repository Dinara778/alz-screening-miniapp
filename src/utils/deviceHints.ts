/** Android WebView (Telegram) часто даёт полосы на feGaussianBlur в SVG. */
export function shouldReduceSvgFilters(): boolean {
  if (typeof navigator === 'undefined') return false;
  const plat = (window.Telegram?.WebApp?.platform || '').toLowerCase();
  if (plat === 'android') return true;
  return /android/i.test(navigator.userAgent);
}
