import { useEffect, useState } from 'react';
import {
  dismissInstallBanner,
  getInstallPlatform,
  resolveInstallUiMode,
  shouldOfferPwaInstall,
  type InstallUiMode,
} from '../utils/pwaInstall';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const SITE_URL = 'https://cortaapp.ru';

export const InstallAppBanner = () => {
  const [mode, setMode] = useState<InstallUiMode>('hidden');
  const [nativeEvent, setNativeEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!shouldOfferPwaInstall()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setNativeEvent(e as BeforeInstallPromptEvent);
      setMode(resolveInstallUiMode(true));
    };

    window.addEventListener('beforeinstallprompt', onBip);
    setMode(resolveInstallUiMode(false));

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (mode === 'hidden') return null;

  const close = () => {
    dismissInstallBanner();
    setMode('hidden');
  };

  const runNativeInstall = async () => {
    if (!nativeEvent) return;
    setInstalling(true);
    try {
      await nativeEvent.prompt();
      await nativeEvent.userChoice;
      close();
    } finally {
      setInstalling(false);
    }
  };

  const platform = getInstallPlatform();
  const isIosChrome = platform === 'ios' && /CriOS/i.test(navigator.userAgent);

  let title = 'Добавьте Corta на главный экран';
  let body = 'Так тест и отчёт будут открываться в один тап — как приложение.';

  if (mode === 'in-app-browser') {
    title = 'Откройте Corta в браузере';
    body = `Сейчас сайт открыт внутри мессенджера. Нажмите «⋯» → «Открыть в браузере» или скопируйте ссылку: ${SITE_URL}`;
  } else if (mode === 'ios') {
    if (isIosChrome) {
      body =
        'В Chrome: меню «⋯» внизу справа → «Добавить на главный экран». Или откройте cortaapp.ru в Safari → Поделиться → «На экран Домой».';
    } else {
      body = 'В Safari: кнопка «Поделиться» внизу → «На экран Домой». На iPhone это стандартный способ установки.';
    }
  } else if (mode === 'android-manual') {
    body = 'В Chrome: меню «⋮» → «Добавить на главный экран» или «Установить приложение».';
  } else if (mode === 'native' && !nativeEvent) {
    body = 'В Chrome: иконка «Установить» в адресной строке или меню браузера → «Установить Corta».';
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      role="region"
      aria-label="Установка приложения"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-400/30 bg-[#0a1210]/95 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs leading-relaxed text-white/75">{body}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-white/45 hover:text-white/80"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {mode === 'native' && nativeEvent ? (
            <button
              type="button"
              disabled={installing}
              onClick={() => void runNativeInstall()}
              className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {installing ? 'Устанавливаем…' : 'Установить'}
            </button>
          ) : mode === 'in-app-browser' ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(SITE_URL);
              }}
              className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Скопировать ссылку
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/30"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
};
