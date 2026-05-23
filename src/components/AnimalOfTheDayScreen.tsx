import { useMemo, useState } from 'react';
import type { AnimalOfTheDayCard } from '../copy/animalOfTheDay';
import { CalmScreen } from './results/CalmScreen';
import { Button } from './Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { shareAnimalOfTheDay } from '../utils/shareAnimal';

const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

type Props = {
  card: AnimalOfTheDayCard;
  onContinue: () => void;
};

export const AnimalOfTheDayScreen = ({ card, onContinue }: Props) => {
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const displayEmoji = useMemo(() => card.emoji, [card.emoji]);

  const handleShare = async () => {
    setShareNotice(null);
    setShareBusy(true);
    try {
      const mode = await shareAnimalOfTheDay(card);
      if (mode === 'download_and_telegram') {
        setShareNotice('Картинка сохранена — прикрепите её в чат; ссылка на бота откроется отдельно');
      } else if (mode === 'clipboard') {
        setShareNotice('Картинка сохранена, текст скопирован');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setShareNotice('Не удалось поделиться');
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <CalmScreen
      kickerProminent
      kicker="Сегодня ты:"
      footer={
        <>
          {shareNotice ? (
            <p className="text-center text-xs leading-relaxed text-white/70">{shareNotice}</p>
          ) : null}
          <Button type="button" className={CTA_BUTTON_CLASS} disabled={shareBusy} onClick={() => void handleShare()}>
            {shareBusy ? 'Готовим картинку…' : 'Поделиться'}
          </Button>
          <button type="button" className={calmBtnGhost} onClick={onContinue}>
            Далее
          </button>
        </>
      }
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 px-2">
        <span
          className="select-none text-[clamp(5.5rem,28vw,8.5rem)] leading-none"
          role="img"
          aria-label={card.animalLabel}
        >
          {displayEmoji}
        </span>
        <p className="text-[clamp(1.75rem,8vw,2.5rem)] font-bold leading-tight text-white">{card.animalLabel}</p>
        <div className="calm-inset w-full space-y-3 text-center text-base leading-relaxed text-white/90 sm:text-lg">
          <p>{card.fixedLine}</p>
          <p className="text-white/78">{card.indexLine}</p>
        </div>
      </div>
    </CalmScreen>
  );
};
