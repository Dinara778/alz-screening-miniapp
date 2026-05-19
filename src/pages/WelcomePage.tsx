import { FormEvent, useRef, useState } from 'react';
import { BackArrowButton } from '../components/BackArrowButton';
import { Button } from '../components/Button';
import { IconArrowRight } from '../components/landing/LandingIcons';
import { ProgressBar } from '../components/ProgressBar';
import { ParticipantProfile } from '../types';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

/** После интро: имя → телефон → пол → возраст → образование+почта → экран перед заданиями. */
const FIELD_STEP_MAX = 7;

const inputClass =
  'calm-input';

const shellClass = 'calm-card';

export const WelcomePage = ({ onStart, onHistory }: Props) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState<ParticipantProfile['sex']>('Женский');
  const [age, setAge] = useState('');
  const [education, setEducation] = useState('');
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
        phone: phone.trim() || undefined,
      },
    }).catch(() => {});
  };

  const goNext = () => setStep((s) => Math.min(FIELD_STEP_MAX, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const canAdvanceFrom = (s: number): boolean => {
    if (s === 0) return true;
    if (s === 1) return name.trim().length >= 2;
    if (s === 2) return phone.trim().length >= 6;
    if (s === 3) return true;
    if (s === 4) {
      const n = Number(age);
      return Number.isFinite(n) && n >= 18 && n <= 100;
    }
    if (s === 5) return education.trim().length >= 2 && email.trim().includes('@');
    return false;
  };

  const buildProfile = (): ParticipantProfile | null => {
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const parsedAge = Number(age);
    if (!name.trim() || !normalizedEmail || !normalizedPhone || !education.trim() || !Number.isFinite(parsedAge)) {
      return null;
    }
    return {
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      sex,
      age: parsedAge,
      education: education.trim(),
      educationYears: 12,
      pcConfidence: 3,
    };
  };

  const completeEducationStep = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdvanceFrom(5) || !buildProfile()) return;

    const profile = buildProfile()!;
    void sendAnalyticsEventToSheets({
      eventType: 'form_submitted',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      participant: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        sex: profile.sex,
        age: profile.age,
        education: profile.education,
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

  if (step === 6) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex min-h-0 flex-1 flex-col justify-center space-y-5 px-1 sm:px-2">
          <p className="text-base leading-relaxed calm-body dark:text-slate-200 sm:text-lg">
            Дальше вас ждут короткие задания, которые помогут понять ваше текущее когнитивное состояние по вашим
            поведенческим паттернам.
          </p>
          <p className="text-base font-semibold text-emerald-900 dark:text-emerald-200 sm:text-lg">
            Это займёт около {TEST_DURATION_LABEL}.
          </p>
          <p className="text-sm leading-relaxed calm-body dark:text-slate-300 sm:text-base">
            По возможности выполняйте их в спокойной обстановке, без отвлечений.
          </p>
        </div>
        <div className="mt-auto shrink-0 pb-2 pt-4">
          <Button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:rounded-3xl sm:py-[1.125rem] sm:text-xl"
            onClick={startAssessment}
          >
            <span>Начать оценку</span>
            <IconArrowRight className="h-5 w-5 shrink-0" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 pt-12">
      {step >= 1 && step <= 5 ? <BackArrowButton onClick={goBack} /> : null}
      <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-between px-1 text-5xl opacity-[0.14] select-none dark:opacity-[0.1]">
        <span>🌿</span>
        <span>🍊</span>
      </div>

      <div className={shellClass}>
        <div className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-20">🌱</div>
        <div className="pointer-events-none absolute -bottom-4 left-4 text-6xl opacity-15">☀️</div>

        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide calm-accent">
            <span>
              {step === 0 ? 'Знакомство' : `Шаг ${step} из ${FIELD_STEP_MAX}`}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
              {step === 0
                ? 'впереди 7 шагов'
                : step >= FIELD_STEP_MAX - 1
                  ? 'финиш ✨'
                  : `осталось шагов: ${FIELD_STEP_MAX - step}`}
            </span>
          </div>
          <ProgressBar value={progressValue} max={FIELD_STEP_MAX} />
        </div>

        {step === 0 && (
          <div className="relative z-10 space-y-5 text-center sm:text-left">
            <h2 className="app-heading text-center">
              Несколько вопросов перед началом оценки
            </h2>
            <p className="calm-caption sm:text-base">
              Имя, контакты, возраст и образование. Займёт около минуты.
            </p>
            <div className="w-full">
              <Button
                type="button"
                className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
                onClick={goNext}
              >
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">✨</div>
            <h2 className="app-heading text-center">Как вас зовут?</h2>
            <p className="text-center calm-caption">
              Укажите, как к вам обращаться
            </p>
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
            <Button type="button" className="w-full" disabled={!canAdvanceFrom(1)} onClick={goNext}>
              Далее
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">📱</div>
            <h2 className="app-heading text-center">Телефон для связи</h2>
            <p className="text-center calm-caption">
              Можно с пробелами и скобками — как вам удобно
            </p>
            <input
              className={inputClass}
              placeholder="Телефон"
              type="tel"
              value={phone}
              autoFocus
              onChange={(e) => {
                sendFormStartedEvent('phone');
                setPhone(e.target.value);
              }}
            />
            <Button type="button" className="w-full" disabled={!canAdvanceFrom(2)} onClick={goNext}>
              Далее
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">👥</div>
            <h2 className="app-heading text-center">Выберите пол</h2>
            <p className="text-center calm-caption">
              Нужен для корректной нормы в аналитике
            </p>
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
            <Button type="button" className="w-full" onClick={goNext}>
              Далее
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">🎂</div>
            <h2 className="app-heading text-center">Ваш возраст</h2>
            <p className="text-center calm-caption">
              Полных лет, от 18 до 100
            </p>
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
            <Button type="button" className="w-full" disabled={!canAdvanceFrom(4)} onClick={goNext}>
              Далее
            </Button>
          </div>
        )}

        {step === 5 && (
          <form className="relative z-10 space-y-4" onSubmit={completeEducationStep}>
            <div className="text-center text-5xl">🎓</div>
            <h2 className="app-heading text-center">Образование и почта</h2>
            <p className="text-center calm-caption">
              Последний шаг — и можно начинать замер
            </p>
            <input
              className={inputClass}
              placeholder="Образование"
              value={education}
              autoFocus
              onChange={(e) => {
                sendFormStartedEvent('education');
                setEducation(e.target.value);
              }}
            />
            <input
              className={inputClass}
              placeholder="Почта"
              type="email"
              value={email}
              onChange={(e) => {
                sendFormStartedEvent('email');
                setEmail(e.target.value);
              }}
            />
            <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100/90">
              📧 Почта — для сервисных сообщений и отчёта о результатах.
            </p>
            <Button type="submit" className="w-full text-base" disabled={!canAdvanceFrom(5)}>
              Далее
            </Button>
          </form>
        )}
      </div>

      {step === 0 ? (
        <Button type="button" variant="secondary" onClick={onHistory} className="w-full sm:w-auto">
          📚 История прохождений
        </Button>
      ) : null}

    </div>
  );
};
