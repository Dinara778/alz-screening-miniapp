import { Button } from './Button';
import { CabinetAccessLink } from './CabinetAccessLink';
import { CalmScreen } from './results/CalmScreen';
import { SupportFooter } from './SupportFooter';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { useApp } from '../context/AppContext';

const RETURN_ROWS = [
  {
    situation: '📅 Завтра утром',
    why: 'Оценить, как вы восстановились за ночь',
  },
  {
    situation: '💼 Перед важной встречей',
    why: 'Собраться и сфокусироваться на главном',
  },
  {
    situation: '🧠 После интенсивной работы',
    why: 'Снять накопившееся напряжение и прояснить мысли',
  },
  {
    situation: '😰 Когда чувствуете стресс',
    why: 'Привести состояние в рабочее русло',
  },
] as const;

type Props = {
  onDone: () => void;
};

export const AssessmentCompleteScreen = ({ onDone }: Props) => {
  const { participant } = useApp();
  const accountEmail = participant?.email ?? null;

  return (
    <CalmScreen
      contentAlign="readable"
      footer={
        <div className="space-y-3">
          <Button type="button" className={CTA_BUTTON_CLASS} onClick={onDone}>
            Я вернусь!
          </Button>
          <CabinetAccessLink variant="button" expectedEmail={accountEmail} />
          <SupportFooter showDeveloperCredit={false} showCabinetAccess={false} />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md space-y-5 pb-4 results-prose">
        <p className="text-base leading-relaxed text-white/90 sm:text-lg">
          Corta daily помогает вам подходить к важным делам в нужной форме.
        </p>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white sm:text-lg">Когда стоит вернуться</h2>
          <div className="assessment-complete-table calm-inset overflow-hidden">
            <div className="assessment-complete-table-head" aria-hidden>
              <span>Ситуация</span>
              <span>Зачем</span>
            </div>
            <ul className="assessment-complete-table-body">
              {RETURN_ROWS.map((row) => (
                <li key={row.situation} className="assessment-complete-table-row">
                  <span className="assessment-complete-situation">{row.situation}</span>
                  <span className="assessment-complete-why">{row.why}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </CalmScreen>
  );
};
