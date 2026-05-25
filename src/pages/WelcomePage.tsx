import { useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { BackArrowButton } from '../components/BackArrowButton';
import { CalmCardShell } from '../components/CalmCardShell';
import { Button } from '../components/Button';
import { ScreenBottomCta } from '../components/ScreenBottomCta';
import { IconArrowRight } from '../components/landing/LandingIcons';
import { ProgressBar } from '../components/ProgressBar';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { ParticipantProfile } from '../types';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

/** Интро (2 экрана) → имя → пол → возраст → старт оценки. */
const FIELD_STEP_MAX = 5;

const SEX_OPTIONS = ['Женский', 'Мужской'] as const satisfies readonly ParticipantProfile['sex'][];

const PROFILE_PREVIEW_ITEMS = [
  '⚡ Насколько быстро сейчас работает мозг',
  '🎯 Легко ли вы отвлекаетесь',
  '🧩 Насколько хорошо удерживаете информацию в моменте',
  '🔋 Есть ли признаки когнитивной перегрузки',
  '📉 Снижается ли качество работы под нагрузкой',
] as const;

const inputClass = 'calm-input';

const scrollFieldIntoView = (e: FocusEvent<HTMLInputElement>) => {
  requestAnimationFrame(() => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
};

export const WelcomePage = ({ onStart, onHistory }: Props) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<ParticipantProfile['sex']>('Женский');
  const [age, setAge] = useState('');
  const formSessionIdRef = useRef(`welcome-${Date.now()}`);
  const hasSentFormStartRef = useRef(false);

  const sendFormStartedEvent = (triggerField: string) => {
    if (hasSentFormStartRef.current) return;
    hasSentFormStartRef.current = true;
    void sendAnalyticsEventToSheets({
      eventType: 'form_started',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      triggerField,
      participant: {
        name: name.trim() || undefined,
      },
    }).catch(() => {});
  };

  const goNext = () => setStep((s) => Math.min(FIELD_STEP_MAX, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const canAdvanceFrom = (s: number): boolean => {
    if (s <= 2) return true;
    if (s === 3) return true;
    if (s === 4) {
      const n = Number(age);
      return Number.isFinite(n) && n >= 18 && n <= 100;
    }
    return false;
  };

  const buildProfile = (): ParticipantProfile | null => {
    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      return null;
    }
    return {
      name: name.trim() || 'Не указано',
      email: 'Не указано',
      phone: 'Не указано',
      sex,
      age: parsedAge,
      education: 'Не указано',
      educationYears: 12,
      pcConfidence: 3,
    };
  };

  const completeFormSteps = () => {
    const profile = buildProfile();
    if (!profile) return;

    void sendAnalyticsEventToSheets({
      eventType: 'form_submitted',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      participant: {
        name: profile.name,
        sex: profile.sex,
        age: profile.age,
        pcConfidence: 3,
      },
    }).catch(() => {});

    goNext();
  };

  const startAssessment = () => {
    const profile = buildProfile();
    if (!profile) return;
    onStart(profile);
  };

  const progressValue = step === 0 ? 0 : step;

  const nextButton = (fromStep: number, opts?: { type?: 'button' | 'submit'; form?: string }) => (
    <Button
      type={opts?.type ?? 'button'}
      form={opts?.form}
      className={CTA_BUTTON_CLASS}
      disabled={fromStep > 0 && !canAdvanceFrom(fromStep)}
      onClick={opts?.type === 'submit' ? undefined : goNext}
    >
      Далее
    </Button>
  );

  if (step === 5) {
    return (
      <CalmCardShell fill>
        <ScreenBottomCta
          footer={
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={startAssessment}>
              <span className="flex items-center justify-center gap-2">
                Начать оценку
                <IconArrowRight className="h-5 w-5 shrink-0" />
              </span>
            </Button>
          }
        >
          <div className="space-y-5 px-1 sm:px-2">
            <p className="text-base leading-relaxed calm-body sm:text-lg">
              Дальше вас ждут короткие задания, которые помогут понять ваше текущее когнитивное состояние по вашим
              поведенческим паттернам.
            </p>
            <p className="text-base font-semibold text-emerald-200 sm:text-lg">
              Это займёт около {TEST_DURATION_LABEL}.
            </p>
            <p className="text-sm leading-relaxed calm-body sm:text-base">
              По возможности выполняйте их в спокойной обстановке, без отвлечений.
            </p>
          </div>
        </ScreenBottomCta>
      </CalmCardShell>
    );
  }

  let stepBody: ReactNode = null;
  let stepFooter: React.ReactNode = nextButton(step);
  const introStep = step <= 1;

  if (step === 0) {
    stepBody = (
      <div className="space-y-5 text-center sm:text-left">
        <h2 className="app-heading text-center leading-snug">
          Ваш мозг сейчас в ресурсе или перегружен?
        </h2>
        <p className="calm-body text-base leading-relaxed sm:text-lg">
          За {TEST_DURATION_LABEL} система оценит внимание, память и скорость обработки информации.
        </p>
        <p className="calm-body text-base leading-relaxed text-white/88 sm:text-lg">
          Вы узнаете: ваш текущий уровень когнитивного ресурса, есть ли признаки перегрузки, рекомендации для
          быстрого восстановления ресурсов мозга.
        </p>
      </div>
    );
    stepFooter = nextButton(0);
  } else if (step === 1) {
    stepBody = (
      <div className="space-y-5 text-center sm:text-left">
        <h2 className="app-heading text-center leading-snug">Оценка когнитивного профиля</h2>
        <p className="calm-body text-base leading-relaxed sm:text-lg">
          Займёт около {TEST_DURATION_LABEL}. Мы поможем понять:
        </p>
        <ul className="calm-inset space-y-2.5 text-left text-base leading-relaxed text-white/88 sm:text-lg">
          {PROFILE_PREVIEW_ITEMS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    );
    stepFooter = nextButton(1);
  } else if (step === 2) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-4xl">✨</div>
        <h2 className="app-heading text-center">Как вас зовут?</h2>
        <p className="text-center calm-caption">Необязательно — можно пропустить</p>
        <input
          className={inputClass}
          placeholder="Имя"
          value={name}
          autoFocus
          onFocus={scrollFieldIntoView}
          onChange={(e) => {
            sendFormStartedEvent('name');
            setName(e.target.value);
          }}
        />
      </div>
    );
    stepFooter = nextButton(2);
  } else if (step === 3) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-4xl">👥</div>
        <h2 className="app-heading text-center">Выберите пол</h2>
        <p className="text-center calm-caption">Нужен для корректной нормы в аналитике</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEX_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                sendFormStartedEvent('sex');
                setSex(opt);
              }}
              className={`rounded-2xl border-2 px-3 py-4 text-center text-sm font-bold transition ${
                sex === opt
                  ? 'border-teal-400/80 bg-teal-500/30 text-white shadow-md ring-2 ring-teal-400/40'
                  : 'border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {opt === 'Женский' ? '👩' : '👨'} {opt}
            </button>
          ))}
        </div>
      </div>
    );
    stepFooter = nextButton(3);
  } else if (step === 4) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-4xl">🎂</div>
        <h2 className="app-heading text-center">Ваш возраст</h2>
        <p className="text-center calm-caption">Полных лет, от 18 до 100</p>
        <input
          className={inputClass}
          placeholder="Возраст"
          type="number"
          min={18}
          max={100}
          value={age}
          autoFocus
          onFocus={scrollFieldIntoView}
          onChange={(e) => {
            sendFormStartedEvent('age');
            setAge(e.target.value);
          }}
        />
      </div>
    );
    stepFooter = (
      <Button
        type="button"
        className={CTA_BUTTON_CLASS}
        disabled={!canAdvanceFrom(4)}
        onClick={completeFormSteps}
      >
        Далее
      </Button>
    );
  }

  const stackForm = step >= 2 && step <= 4;

  return (
    <div className={`flex flex-col ${stackForm ? 'shrink-0' : 'min-h-0 flex-1'}`}>
      <CalmCardShell fill={introStep}>
        <div className="relative mb-4 shrink-0 space-y-3">
          <div className="flex items-start gap-3">
            {step >= 1 && step <= 4 ? (
              <BackArrowButton onClick={goBack} className="mt-0.5 shrink-0" aria-label="Назад" />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                {step === 0 ? (
                  <span className="text-xs font-bold uppercase tracking-wide text-teal-300/95">Знакомство</span>
                ) : (
                  <span className="text-xs font-semibold tracking-wide text-teal-300/95">
                    Шаг {step}{' '}
                    <span className="font-medium text-white/45">из {FIELD_STEP_MAX}</span>
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[0.6875rem] font-medium text-white/65">
                  {step === 0
                    ? 'впереди 5 шагов'
                    : step >= FIELD_STEP_MAX - 1
                      ? 'финиш ✨'
                      : `осталось: ${FIELD_STEP_MAX - step}`}
                </span>
              </div>
              <ProgressBar value={progressValue} max={FIELD_STEP_MAX} />
            </div>
          </div>
        </div>

        <ScreenBottomCta
          className="relative z-10"
          fill={introStep}
          stackFooter={stackForm}
          contentAlign={introStep ? 'center' : 'start'}
          footer={stepFooter}
          footerExtra={
            step === 0 ? (
              <Button type="button" variant="secondary" onClick={onHistory} className="w-full">
                📚 История прохождений
              </Button>
            ) : undefined
          }
        >
          {stepBody}
        </ScreenBottomCta>
      </CalmCardShell>
    </div>
  );
};
