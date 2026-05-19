import { Button } from '../components/Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { IntroShell } from '../components/landing/IntroShell';

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
    <IntroShell
      aria-label="Что мы анализируем"
      footer={footer}
      centerContent={false}
      fillViewport
      compactFit
    >
      <div className="min-h-0 space-y-2">
        <h1 className="text-left text-lg font-bold leading-tight text-white sm:text-xl">
          Оценка когнитивного профиля
        </h1>
        <p className="text-xs leading-snug text-white/50 sm:text-sm">
          Оценка займёт около {TEST_DURATION_LABEL}.
        </p>
        <div className="calm-inset p-3 sm:p-3.5">
          <div className="text-base font-bold leading-snug text-white/95 sm:text-lg">Что мы анализируем:</div>
          <ul className="mt-1.5 space-y-1 text-[0.8125rem] leading-snug text-white/88 sm:space-y-1.5 sm:text-sm">
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
