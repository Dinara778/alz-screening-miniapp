import { Button } from '../components/Button';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { IntroShell } from '../components/landing/IntroShell';

/** Зелёная обводка заголовка — как CTA (#34d399 в .cta-shimmer). */
const INTRO_TITLE_ACCENT = '#34d399';

type Props = {
  onContinue: () => void;
};

const PROFILE_PREVIEW_ITEMS = [
  '⚡ Насколько быстро сейчас работает мозг',
  '🎯 Легко ли вы отвлекаетесь',
  '🧩 Насколько хорошо удерживаете информацию в моменте',
  '🔋 Есть ли признаки когнитивной перегрузки',
  '📉 Снижается ли качество работы под нагрузкой',
] as const;

export const IntroTestOfferPage = ({ onContinue }: Props) => {
  const footer = (
    <Button type="button" className={CTA_BUTTON_CLASS} onClick={onContinue}>
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="Оценка когнитивного профиля" footer={footer} compact>
      <div className="space-y-4 overflow-visible pb-2 text-left">
        <SketchHighlightTitle
          accent={INTRO_TITLE_ACCENT}
          generousOutline
          className="sketch-highlight-title--flush-start"
        >
          Оценка когнитивного профиля
        </SketchHighlightTitle>
        <p className="text-lg font-bold leading-snug text-white sm:text-xl">Мы поможем понять:</p>
        <div className="calm-inset">
          <ul className="space-y-2.5 text-sm leading-relaxed text-white/90 sm:text-base">
            {PROFILE_PREVIEW_ITEMS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </IntroShell>
  );
};
