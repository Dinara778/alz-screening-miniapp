import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { Footer } from '../components/Footer';
import { ParticipantProfile } from '../types';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

/** После интро: имя → телефон → пол → возраст → образование+почта (почта обязательна для профиля). */
const FIELD_STEP_MAX = 6;

const inputClass =
  'w-full rounded-2xl border-2 border-emerald-300/90 bg-white/95 px-4 py-3.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200/70 dark:border-emerald-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/40';

const shellClass =
  'relative overflow-hidden rounded-3xl border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-teal-50/90 to-orange-50/70 p-6 shadow-brand-lg ring-1 ring-orange-200/50 dark:border-emerald-700/60 dark:from-emerald-950/80 dark:via-slate-900 dark:to-orange-950/30 dark:ring-orange-900/20';

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdvanceFrom(5)) return;
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const parsedAge = Number(age);
    if (!name.trim() || !normalizedEmail || !normalizedPhone || !education.trim() || !Number.isFinite(parsedAge)) return;

    void sendAnalyticsEventToSheets({
      eventType: 'form_submitted',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      participant: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        sex,
        age: parsedAge,
        education: education.trim(),
        pcConfidence: 3,
      },
    }).catch(() => {});

    onStart({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      sex,
      age: parsedAge,
      education: education.trim(),
      educationYears: 12,
      pcConfidence: 3,
    });
  };

  const progressValue = step === 0 ? 0 : step;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-between px-1 text-5xl opacity-[0.14] select-none dark:opacity-[0.1]">
        <span>🌿</span>
        <span>🍊</span>
      </div>

      <div className={shellClass}>
        <div className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-20">🌱</div>
        <div className="pointer-events-none absolute -bottom-4 left-4 text-6xl opacity-15">☀️</div>

        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            <span>
              {step === 0 ? 'Знакомство' : `Шаг ${step} из ${FIELD_STEP_MAX}`}
            </span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100">
              {step === 0
                ? 'впереди 6 шагов'
                : step >= FIELD_STEP_MAX - 1
                  ? 'финиш ✨'
                  : `осталось шагов: ${FIELD_STEP_MAX - step}`}
            </span>
          </div>
          <ProgressBar value={progressValue} max={FIELD_STEP_MAX} />
        </div>

        {step === 0 && (
          <div className="relative z-10 space-y-5 text-center sm:text-left">
            <h2 className="text-xl font-bold text-emerald-950 dark:text-emerald-50 sm:text-2xl">
              Короткая анкета перед тестом
            </h2>
            <p className="text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90 sm:text-base">
              Несколько вопросов — имя, контакты, возраст. Займёт около минуты, данные остаются на вашем устройстве.
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
            <h2 className="text-center text-xl font-bold text-emerald-950 dark:text-emerald-50">Как вас зовут?</h2>
            <p className="text-center text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90">
              Имя сохранится только на этом устройстве
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
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Назад
              </Button>
              <Button type="button" disabled={!canAdvanceFrom(1)} onClick={goNext}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">📱</div>
            <h2 className="text-center text-xl font-bold text-emerald-950 dark:text-emerald-50">Телефон для связи</h2>
            <p className="text-center text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90">
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
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Назад
              </Button>
              <Button type="button" disabled={!canAdvanceFrom(2)} onClick={goNext}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">👥</div>
            <h2 className="text-center text-xl font-bold text-emerald-950 dark:text-emerald-50">Выберите пол</h2>
            <p className="text-center text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90">
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
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-orange-300/60 dark:ring-orange-400/30'
                      : 'border-emerald-200 bg-white/90 text-emerald-900 hover:border-orange-300 hover:bg-orange-50/80 dark:border-emerald-700 dark:bg-slate-800/90 dark:text-emerald-100'
                  }`}
                >
                  {opt === 'Женский' ? '👩' : opt === 'Мужской' ? '👨' : '✨'} {opt}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Назад
              </Button>
              <Button type="button" onClick={goNext}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="relative z-10 space-y-4">
            <div className="text-center text-5xl">🎂</div>
            <h2 className="text-center text-xl font-bold text-emerald-950 dark:text-emerald-50">Ваш возраст</h2>
            <p className="text-center text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90">
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
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Назад
              </Button>
              <Button type="button" disabled={!canAdvanceFrom(4)} onClick={goNext}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <form className="relative z-10 space-y-4" onSubmit={submit}>
            <div className="text-center text-5xl">🎓</div>
            <h2 className="text-center text-xl font-bold text-emerald-950 dark:text-emerald-50">Образование и почта</h2>
            <p className="text-center text-sm font-medium text-emerald-800/90 dark:text-emerald-200/90">
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
            <p className="rounded-xl border border-orange-200/80 bg-orange-50/90 px-3 py-2 text-center text-xs text-orange-950 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-100">
              📧 Почта — для сервисных сообщений и отчёта; храним данные только на вашем устройстве.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Назад
              </Button>
              <Button type="submit" className="min-w-[200px] flex-1 text-base" disabled={!canAdvanceFrom(5)}>
                Начать тест
              </Button>
            </div>
            <TimerHint />
          </form>
        )}
      </div>

      {step === 0 ? (
        <Button type="button" variant="secondary" onClick={onHistory} className="w-full sm:w-auto">
          📚 История прохождений
        </Button>
      ) : null}

      <Footer />
    </div>
  );
};

/** Ориентир по времени + мини-обратный отсчёт (формулировка «на весь тест»). */
function TimerHint() {
  const [n, setN] = useState(5);
  useEffect(() => {
    let ticks = 5;
    const id = window.setInterval(() => {
      ticks -= 1;
      setN(Math.max(0, ticks));
      if (ticks <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-1 text-center">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
        ⏱️ Ориентир по времени: <span className="text-orange-700 dark:text-orange-300">~5 минут</span> на весь тест
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Мини-таймер: {n > 0 ? `${n}…` : 'готово к старту ✓'}
      </p>
    </div>
  );
}
