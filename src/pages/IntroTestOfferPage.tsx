import { Button } from '../components/Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';

type Props = {
  onContinue: () => void;
};

const MEASURES = [
  'Скорость обработки информации (как быстро мозг реагирует и переключается).',
  'Стабильность внимания (насколько внимание устойчиво к отвлечениям).',
  'Вариативность реакций (насколько мозг работает «ровно», без «рывков»).',
  'Рабочая память (удержание информации в моменте).',
  'Когнитивная выносливость (как быстро мозг начинает уставать).',
] as const;

const MEASURE_ICONS = ['⚡', '🎯', '〰️', '🧩', '💪'] as const;

export const IntroTestOfferPage = ({ onContinue }: Props) => {
  const footer = (
    <Button
      type="button"
      className={CTA_BUTTON_CLASS}
      onClick={onContinue}
    >
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="Что мы анализируем" footer={footer}>
      <div className="space-y-4 pb-4">
        <h1 className="text-left text-xl font-bold leading-snug text-white sm:text-2xl">
          Оценка когнитивного профиля
        </h1>
        <p className="calm-caption">Оценка займёт около {TEST_DURATION_LABEL}.</p>
        <div className="calm-inset">
          <div className="app-heading">Что мы анализируем:</div>
          <ul className="mt-2 space-y-2 text-sm text-white dark:text-slate-200 sm:text-base">
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
