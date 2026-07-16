import { Button } from './Button';
import { CalmScreen } from './results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';

type Props = {
  onSubscribe: () => void;
  onSkip: () => void;
  busy?: boolean;
};

export const SubscriptionUpsellScreen = ({ onSubscribe, onSkip, busy = false }: Props) => (
  <CalmScreen
    contentAlign="readable"
    footer={
      <div className="space-y-3">
        <Button
          type="button"
          variant="sell"
          className={CTA_BUTTON_CLASS}
          disabled={busy}
          onClick={onSubscribe}
        >
          {busy ? 'Открываем оплату…' : 'Оформить подписку за 499 ₽/мес'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={`${CTA_BUTTON_CLASS} font-semibold`}
          disabled={busy}
          onClick={onSkip}
        >
          Не сейчас
        </Button>
      </div>
    }
  >
    <div className="mx-auto w-full max-w-md space-y-5 pb-2 text-left">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-[1.75rem] leading-none text-orange-300" aria-hidden>
          ☆
        </span>
        <h1 className="app-heading leading-snug text-white">
          Хотите видеть, как меняется состояние мозга?
        </h1>
      </div>
      <p className="text-base leading-relaxed text-white/85 sm:text-lg">
        Подписка даёт более полную картину работы мозга: как вы восстанавливаетесь после сна,
        реагируете на стресс, переносите нагрузку и в какие моменты можете рассчитывать на
        максимальную концентрацию и продуктивность.
      </p>
    </div>
  </CalmScreen>
);
