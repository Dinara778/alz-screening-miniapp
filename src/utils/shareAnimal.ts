import type { AnimalOfTheDayCard } from '../copy/animalOfTheDay';
import { getShareTestLink, type ShareResultMode } from './shareResult';
import { renderShareAnimalCard } from './shareAnimalCard';

export function buildAnimalShareCaption(card: AnimalOfTheDayCard): string {
  const link = getShareTestLink();
  return `${card.fixedLine}\n${card.indexLine}\n\nПопробуй Corta:\n${link}`;
}

export async function shareAnimalOfTheDay(card: AnimalOfTheDayCard): Promise<ShareResultMode> {
  const caption = buildAnimalShareCaption(card);
  const blob = await renderShareAnimalCard({ card });
  const file = new File([blob], 'corta-animal-dnya.png', { type: 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const payload = { files: [file], text: caption, title: 'Corta — животное дня' };
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
    const link = getShareTestLink();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
      `${card.fixedLine}\n${card.indexLine}`,
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
