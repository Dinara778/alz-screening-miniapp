const DISMISS_KEY = 'corta-install-dismissed-until';
const DISMISS_DAYS = 14;

/** Баннер «Установить на главный экран» — позже только для подписчиков. */
export const PWA_INSTALL_BANNER_ENABLED = false;

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export type InstallUiMode = 'native' | 'ios' | 'android-manual' | 'in-app-browser' | 'hidden';

/** Уже открыто как установленное приложение (standalone). */
export function isStandalonePwa(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** Telegram Mini App — установка на экран не нужна. */
export function isTelegramMiniApp(): boolean {
  const tg = window.Telegram?.WebApp;
  return Boolean(tg?.initData || tg?.platform);
}

/** Встроенный браузер мессенджера / соцсети — установка недоступна. */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Telegram|Instagram|FBAN|FBAV|Line\/|Twitter|LinkedInApp/i.test(ua);
}

export function getInstallPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Windows|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

export function isInstallBannerDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function dismissInstallBanner(): void {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export function shouldOfferPwaInstall(): boolean {
  if (typeof window === 'undefined') return false;
  if (!PWA_INSTALL_BANNER_ENABLED) return false;
  if (!import.meta.env.PROD) return false;
  if (isStandalonePwa()) return false;
  if (isTelegramMiniApp()) return false;
  if (isInstallBannerDismissed()) return false;
  return true;
}

export function resolveInstallUiMode(hasNativePrompt: boolean): InstallUiMode {
  if (!shouldOfferPwaInstall()) return 'hidden';
  if (isInAppBrowser()) return 'in-app-browser';
  if (hasNativePrompt) return 'native';
  const platform = getInstallPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android-manual';
  if (platform === 'desktop') return 'native';
  return 'android-manual';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}
