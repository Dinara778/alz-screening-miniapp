import { FormEvent, useRef, useState, type ReactNode } from 'react';
import { ScreenBackHeader } from '../components/ScreenBackHeader';
import { Button } from '../components/Button';
import { ScreenBottomCta } from '../components/ScreenBottomCta';
import { IconArrowRight } from '../components/landing/LandingIcons';
import { ProgressBar } from '../components/ProgressBar';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { ParticipantProfile } from '../types';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

/** После интро: имя → пол → возраст → почта → экран перед заданиями. */
const FIELD_STEP_MAX = 5;

const inputClass = 'calm-input';

const shellClass = 'calm-card relative flex min-h-0 flex-1 flex-col';

export const WelcomePage = ({ onStart, onHistory }: Props) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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
        email: email.trim() || undefined,
      },
    }).catch(() => {});
  };

  const goNext = () => setStep((s) => Math.min(FIELD_STEP_MAX, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const canAdvanceFrom = (s: number): boolean => {
    if (s === 0) return true;
    if (s === 1) return name.trim().length >= 2;
    if (s === 2) return true;
    if (s === 3) {
      const n = Number(age);
      return Number.isFinite(n) && n >= 18 && n <= 100;
    }
    if (s === 4) return email.trim().includes('@');
    return false;
  };

  const buildProfile = (): ParticipantProfile | null => {
    const normalizedEmail = email.trim();
    const parsedAge = Number(age);
    if (!name.trim() || !normalizedEmail || !Number.isFinite(parsedAge)) {
      return null;
    }
    return {
      name: name.trim(),
      email: normalizedEmail,
      phone: 'Не указано',
      sex,
      age: parsedAge,
      education: 'Не указано',
      educationYears: 12,
      pcConfidence: 3,
    };
  };

  const completeEmailStep = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdvanceFrom(4) || !buildProfile()) return;

    const profile = buildProfile()!;
    void sendAnalyticsEventToSheets({
      eventType: 'form_submitted',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      participant: {
        name: profile.name,
        email: profile.email,
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
      <div className="relative flex min-h-0 flex-1 flex-col">
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
      </div>
    );
  }

  let stepBody: ReactNode = null;
  let stepFooter: React.ReactNode = nextButton(step);

  if (step === 0) {
    stepBody = (
      <div className="space-y-5 text-center sm:text-left">
        <h2 className="app-heading text-center">Несколько вопросов перед началом оценки</h2>
        <p className="calm-caption sm:text-base">Имя, пол, возраст и почта. Займёт около минуты.</p>
      </div>
    );
    stepFooter = nextButton(0);
  } else if (step === 1) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-5xl">✨</div>
        <h2 className="app-heading text-center">Как вас зовут?</h2>
        <p className="text-center calm-caption">Укажите, как к вам обращаться</p>
        <input
          className={inputClass}
          placeholder="Имя"
          value={name}
          autoFocus
          onChange={(e) => {
            sendFormStartedEvent('name');
            setName(e.target.value);
          }}
        />
      </div>
    );
    stepFooter = nextButton(1);
  } else if (step === 2) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-5xl">👥</div>
        <h2 className="app-heading text-center">Выберите пол</h2>
        <p className="text-center calm-caption">Нужен для корректной нормы в аналитике</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['Женский', 'Мужской', 'Другой'] as const).map((opt) => (
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
              {opt === 'Женский' ? '👩' : opt === 'Мужской' ? '👨' : '✨'} {opt}
            </button>
          ))}
        </div>
      </div>
    );
    stepFooter = nextButton(2);
  } else if (step === 3) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-5xl">🎂</div>
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
          onChange={(e) => {
            sendFormStartedEvent('age');
            setAge(e.target.value);
          }}
        />
      </div>
    );
    stepFooter = nextButton(3);
  } else if (step === 4) {
    stepBody = (
      <form id="welcome-email" className="space-y-4" onSubmit={completeEmailStep}>
        <div className="text-center text-5xl">📧</div>
        <h2 className="app-heading text-center">Ваша почта</h2>
        <p className="text-center calm-caption">Последний шаг — и можно начинать замер</p>
        <input
          className={inputClass}
          placeholder="Почта"
          type="email"
          value={email}
          autoFocus
          onChange={(e) => {
            sendFormStartedEvent('email');
            setEmail(e.target.value);
          }}
        />
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100/90">
          📧 Почта — для сервисных сообщений и отчёта о результатах.
        </p>
      </form>
    );
    stepFooter = nextButton(4, { type: 'submit', form: 'welcome-email' });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={shellClass}>
        {step >= 1 && step <= 4 ? <ScreenBackHeader onBack={goBack} className="mb-1" /> : null}

        <div className="relative mb-4 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide calm-accent">
            <span>{step === 0 ? 'Знакомство' : `Шаг ${step} из ${FIELD_STEP_MAX}`}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
              {step === 0
                ? 'впереди 5 шагов'
                : step >= FIELD_STEP_MAX - 1
                  ? 'финиш ✨'
                  : `осталось шагов: ${FIELD_STEP_MAX - step}`}
            </span>
          </div>
          <ProgressBar value={progressValue} max={FIELD_STEP_MAX} />
        </div>

        <ScreenBottomCta
          className="relative z-10 min-h-0 flex-1"
          contentAlign={step === 0 ? 'center' : 'start'}
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
      </div>
    </div>
  );
};
