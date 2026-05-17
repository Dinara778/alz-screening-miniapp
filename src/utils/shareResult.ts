import { TEST_DURATION_LABEL } from '../constants/testDuration';

const DEFAULT_SHARE_URL = 'https://t.me/YourBot';

export function getShareTestLink(): string {
  const v = import.meta.env.VITE_SHARE_BOT_URL as string | undefined;
  return (v && v.trim()) || DEFAULT_SHARE_URL;
}

/** Три уровня для текста «поделиться». */
export function shareBandFromFlags(flags: number): 'нет признаков' | 'наблюдение' | 'высокий риск' {
  if (flags <= 1) return 'нет признаков';
  if (flags <= 3) return 'наблюдение';
  return 'высокий риск';
}

export function buildResultShareText(flags: number, indexValue: number): string {
  const band = shareBandFromFlags(flags);
  const link = getShareTestLink();
  return `Мой когнитивный профиль: индекс ${indexValue}/100 (${band}). Пройди тест за ${TEST_DURATION_LABEL}: ${link}`;
}

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
