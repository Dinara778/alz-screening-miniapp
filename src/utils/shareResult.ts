import { renderShareResultCard } from './shareResultCard';

const DEFAULT_SHARE_URL = 'https://t.me/cortalab_ns_bot';

export function getShareTestLink(): string {
  const v = import.meta.env.VITE_SHARE_BOT_URL as string | undefined;
  return (v && v.trim()) || DEFAULT_SHARE_URL;
}

/** Подпись к картинке: ссылка на бота отдельной строкой под текстом. */
export function buildShareCaption(): string {
  const link = getShareTestLink();
  return `Попробуй бесплатно!\n${link}`;
}

/** Три уровня для совместимости (если понадобится текстовый шаринг). */
export function shareBandFromFlags(flags: number): 'нет признаков' | 'наблюдение' | 'высокий риск' {
  if (flags <= 1) return 'нет признаков';
  if (flags <= 3) return 'наблюдение';
  return 'высокий риск';
}

export type ShareResultMode = 'native' | 'telegram_text' | 'download_and_telegram' | 'clipboard';

export type ShareResultWithCardOptions = {
  indexValue: number;
  accent: string;
};

/** Картинка + ссылка на бота (файл и подпись через системный шаринг или Telegram). */
export async function shareResultWithCard({
  indexValue,
  accent,
}: ShareResultWithCardOptions): Promise<ShareResultMode> {
  const link = getShareTestLink();
  const caption = buildShareCaption();
  const blob = await renderShareResultCard({ indexValue, accent });
  const file = new File([blob], 'corta-kognitivny-profil.png', { type: 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const payload = { files: [file], text: caption, title: 'Corta — когнитивный профиль' };
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'native';
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }

  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
      'ВАУ! Я только что получил отчёт о том, как реально работает мой мозг 🧠\n\nЭто удивительно — понимать себя стало так легко!\n\nПопробуй бесплатно!',
    )}`;
    tg.openTelegramLink(shareUrl);
    return 'download_and_telegram';
  }

  if (navigator.clipboard?.writeText) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    await navigator.clipboard.writeText(caption);
    return 'clipboard';
  }

  throw new Error('share_unavailable');
}

/** @deprecated Используйте shareResultWithCard */
export function buildResultShareText(flags: number, indexValue: number): string {
  const band = shareBandFromFlags(flags);
  return `Мой когнитивный профиль: индекс ${indexValue}/100 (${band}). ${buildShareCaption()}`;
}

/** @deprecated Используйте shareResultWithCard */
export async function shareOrCopyResultText(text: string, link: string): Promise<'telegram' | 'webshare' | 'clipboard'> {
  const tg = window.Telegram?.WebApp;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
    return 'telegram';
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text, url: link, title: 'Когнитивный профиль' });
      return 'webshare';
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text}`);
    return 'clipboard';
  }
  throw new Error('clipboard_unavailable');
}
