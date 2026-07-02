import { Button } from './Button';
import { CabinetAccessLink } from './CabinetAccessLink';
import { CalmScreen } from './results/CalmScreen';
import { SupportFooter } from './SupportFooter';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';

const RETURN_ROWS = [
  {
    situation: '📅 Завтра утром',
    why: 'Проверить, как вы восстановились после сна',
  },
  {
    situation: '💼 Перед важной встречей',
    why: 'Снять тревогу и войти в ресурс',
  },
  {
    situation: '🧠 После интенсивной работы',
    why: 'Сбросить когнитивное напряжение',
  },
  {
    situation: '😰 Когда чувствуете стресс',
    why: 'Экстренно привести себя в норму',
  },
] as const;

type Props = {
  onDone: () => void;
};

export const AssessmentCompleteScreen = ({ onDone }: Props) => (
  <CalmScreen
    contentAlign="readable"
    footer={
      <div className="space-y-3">
        <Button type="button" className={CTA_BUTTON_CLASS} onClick={onDone}>
          Я вернусь!
        </Button>
        <CabinetAccessLink variant="button" />
        <SupportFooter showDeveloperCredit={false} showCabinetAccess={false} />
      </div>
    }
  >
    <div className="mx-auto w-full max-w-md space-y-5 pb-4 results-prose">
      <div className="space-y-4 text-base leading-relaxed text-white/90 sm:text-lg">
        <p>
          Состояние вашего мозга — это не статичная цифра. Оно меняется вместе с вами:
        </p>
        <ul className="list-none space-y-2 pl-0">
          <li>🔹 Утром — один уровень фокуса и памяти.</li>
          <li>🔹 После совещания — другой.</li>
          <li>🔹 Перед важным разговором — третий.</li>
        </ul>
        <p>
          Corta даёт вам инструмент, чтобы всегда входить в важные события в нужном состоянии.
        </p>
      </div>

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
