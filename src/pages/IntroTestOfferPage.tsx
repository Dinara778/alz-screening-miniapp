import { Button } from '../components/Button';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';

/** Зелёная обводка заголовка — как CTA (#34d399 в .cta-shimmer). */
const INTRO_TITLE_ACCENT = '#34d399';

type Props = {
  onContinue: () => void;
};

const MEASURES = [
  'Скорость обработки (реакция и переключение).',
  'Стабильность внимания (устойчивость к отвлечениям).',
  'Вариативность реакций (ровный ритм без «рывков»).',
  'Рабочая память (удержание в моменте).',
  'Когнитивная выносливость (усталость под нагрузкой).',
] as const;

const MEASURE_ICONS = ['⚡', '🎯', '〰️', '🧩', '💪'] as const;

export const IntroTestOfferPage = ({ onContinue }: Props) => {
  const footer = (
    <Button type="button" className={CTA_BUTTON_CLASS} onClick={onContinue}>
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="Что мы анализируем" footer={footer} compact>
      <div className="space-y-4 overflow-visible pb-2">
        <SketchHighlightTitle accent={INTRO_TITLE_ACCENT} className="w-full" generousOutline>
          Оценка когнитивного профиля
        </SketchHighlightTitle>
        <p className="calm-caption">Оценка займёт около {TEST_DURATION_LABEL}.</p>
        <div className="calm-inset">
          <div className="app-heading">Что мы анализируем:</div>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-white/90 sm:text-base">
            {MEASURES.map((line, i) => (
              <li key={line}>
                {MEASURE_ICONS[i]} {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </IntroShell>
  );
};
