import { Button } from '../components/Button';
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
      className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
      onClick={onContinue}
    >
      Далее
    </Button>
  );

  return (
    <IntroShell aria-label="Что измеряет тест" footer={footer}>
      <div className="space-y-4 pb-4">
        <h1 className="app-heading text-left">Поведенческий тест на определение когнитивного профиля</h1>
        <p className="text-sm text-emerald-800 dark:text-emerald-300">Прохождение занимает около {TEST_DURATION_LABEL}.</p>
        <div className="rounded-xl border-2 border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/80 p-4 text-left dark:border-emerald-700/50 dark:from-emerald-950/50 dark:to-slate-800/80">
          <div className="app-heading">Что измеряет тест</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-900 dark:text-slate-200 sm:text-base">
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
