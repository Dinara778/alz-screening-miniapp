import { useRef, useState, useEffect, type FocusEvent, type ReactNode } from 'react';
import { BackArrowButton } from '../components/BackArrowButton';
import { CalmCardShell } from '../components/CalmCardShell';
import { Button } from '../components/Button';
import { CabinetAccessLink } from '../components/CabinetAccessLink';
import { SameEmailHint } from '../components/SameEmailHint';
import { ScreenBottomCta } from '../components/ScreenBottomCta';
import { IconArrowRight } from '../components/landing/LandingIcons';
import { ProgressBar } from '../components/ProgressBar';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { ParticipantProfile } from '../types';
import { TEST_DURATION_LABEL } from '../constants/testDuration';
import { fetchCabinetParticipantProfile } from '../utils/cabinetApi';
import {
  formatProfileResumeLabel,
  loadLocalParticipantProfile,
  saveSavedParticipantProfile,
} from '../utils/participantProfileStore';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import { ensureSupabaseBrowserConfig, getSupabaseBrowser } from '../utils/supabaseBrowser';
import { syncFunnelToSupabase } from '../utils/supabaseFunnelSync';

type Props = {
  visitId: string;
  onStart: (profile: ParticipantProfile) => void;
  onProfileReady?: (profile: ParticipantProfile) => void;
};

/** Знакомство → имя → пол → возраст → email → старт оценки. */
const FIELD_STEP_MAX = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SEX_OPTIONS = ['Женский', 'Мужской'] as const satisfies readonly ParticipantProfile['sex'][];

const inputClass = 'calm-input';

const scrollFieldIntoView = (e: FocusEvent<HTMLInputElement>) => {
  requestAnimationFrame(() => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
};

export const WelcomePage = ({ visitId, onStart, onProfileReady }: Props) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<ParticipantProfile['sex']>('Женский');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [resumeProfile, setResumeProfile] = useState<ParticipantProfile | null>(null);
  const formSessionIdRef = useRef(`welcome-${Date.now()}`);
  const hasSentFormStartRef = useRef(false);

  const applyProfileToForm = (profile: ParticipantProfile) => {
    setName(profile.name);
    setSex(profile.sex);
    setAge(String(profile.age));
    setEmail(profile.email);
  };

  useEffect(() => {
    let cancelled = false;

    const adoptProfile = (profile: ParticipantProfile) => {
      if (cancelled) return;
      applyProfileToForm(profile);
      setResumeProfile(profile);
    };

    const local = loadLocalParticipantProfile();
    if (local) adoptProfile(local);

    void (async () => {
      const cfg = await ensureSupabaseBrowserConfig();
      if (!cfg || cancelled) return;
      try {
        const supabase = await getSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || cancelled) return;
        const remote = await fetchCabinetParticipantProfile(token);
        if (remote && !cancelled) {
          saveSavedParticipantProfile(remote);
          adoptProfile(remote);
        }
      } catch {
        /* кабинет не настроен или нет сессии */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (s === 3) {
      const n = Number(age);
      return Number.isFinite(n) && n >= 18 && n <= 100;
    }
    if (s === 4) {
      const trimmed = email.trim().toLowerCase();
      return EMAIL_RE.test(trimmed) && trimmed.length <= 254;
    }
    return false;
  };

  const buildProfile = (): ParticipantProfile | null => {
    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      return null;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) return null;

    return {
      name: name.trim(),
      email: trimmedEmail,
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
        email: profile.email,
        sex: profile.sex,
        age: profile.age,
        pcConfidence: 3,
      },
    }).catch(() => {});

    void syncFunnelToSupabase({
      email: profile.email,
      visitId,
      lastScreen: 'welcome/email',
      status: 'in_progress',
    });

    onProfileReady?.(profile);
    saveSavedParticipantProfile(profile);

    goNext();
  };

  const startAssessment = () => {
    const profile = buildProfile();
    if (!profile) return;
    saveSavedParticipantProfile(profile);
    void syncFunnelToSupabase({
      email: profile.email,
      visitId,
      lastScreen: 'welcome/ready',
      status: 'in_progress',
    });
    onStart(profile);
  };

  useEffect(() => {
    if (step !== 5) return;
    const profile = buildProfile();
    if (!profile) return;
    void syncFunnelToSupabase({
      email: profile.email,
      visitId,
      lastScreen: 'welcome/ready',
      status: 'in_progress',
    });
  }, [step, visitId, email, age, name, sex]);

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
  const introStep = step === 0;

  if (step === 0 && resumeProfile) {
    stepBody = (
      <div className="space-y-5 text-center sm:text-left">
        <div className="text-center text-4xl">✨</div>
        <h2 className="app-heading text-center">С возвращением!</h2>
        <p className="calm-caption sm:text-base">Продолжить с сохранёнными данными?</p>
        <div className="calm-inset space-y-2 rounded-2xl px-4 py-3 text-left text-sm text-white/90">
          <p className="font-semibold text-white">{formatProfileResumeLabel(resumeProfile)}</p>
          <p className="text-white/65">{resumeProfile.email}</p>
        </div>
      </div>
    );
    stepFooter = (
      <div className="space-y-3">
        <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => setStep(5)}>
          <span className="flex items-center justify-center gap-2">
            Продолжить
            <IconArrowRight className="h-5 w-5 shrink-0" />
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={`${CTA_BUTTON_CLASS} font-semibold`}
          onClick={() => {
            setResumeProfile(null);
            setStep(1);
          }}
        >
          Изменить данные
        </Button>
        <CabinetAccessLink variant="button" />
      </div>
    );
  } else if (step === 0) {
    stepBody = (
      <div className="space-y-5 text-center sm:text-left">
        <h2 className="app-heading text-center">Несколько вопросов перед началом оценки</h2>
        <p className="calm-caption sm:text-base">
          Пол, возраст и email для отчёта, при желании — имя. Займёт около минуты.
        </p>
      </div>
    );
    stepFooter = (
      <div className="space-y-3">
        {nextButton(0)}
        <CabinetAccessLink variant="button" />
      </div>
    );
  } else if (step === 1) {
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
    stepFooter = nextButton(1);
  } else if (step === 2) {
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
    stepFooter = nextButton(2);
  } else if (step === 3) {
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
    stepFooter = nextButton(3);
  } else if (step === 4) {
    stepBody = (
      <div className="space-y-4">
        <div className="text-center text-4xl">✉️</div>
        <h2 className="app-heading text-center">Ваш email</h2>
        <p className="text-center calm-caption">Чтобы сохранить отчёт и историю в личном кабинете</p>
        <SameEmailHint />
        <input
          className={inputClass}
          placeholder="name@example.com"
          type="email"
          autoComplete="email"
          value={email}
          autoFocus
          onFocus={scrollFieldIntoView}
          onChange={(e) => {
            sendFormStartedEvent('email');
            setEmail(e.target.value);
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

  const stackForm = step >= 1 && step <= 4;

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
        >
          {stepBody}
        </ScreenBottomCta>
      </CalmCardShell>
    </div>
  );
};
