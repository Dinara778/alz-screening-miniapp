import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppStage, ParticipantProfile, SessionResult, TrialResult } from '../types';
import {
  clearProgress,
  hasPaymentReturnInUrl,
  isPageReload,
  isRestartBoot,
  loadHistory,
  loadLastSessionId,
  loadSessionFromHistory,
  saveLastSessionId,
  saveProgress,
  saveSession,
  shouldRestoreProgress,
  loadProgress,
} from '../utils/storage';
import { goToIntroFresh, stripPaymentQueryFromUrl } from '../utils/appReload';
import { MID_TEST_STAGES } from '../utils/storage';
import { isReportPaidUnlocked } from '../utils/telegramPayments';
import { pickStudyWordList } from '../utils/generateStimuli';
import { arePaymentsActive, isPaymentsEnabled } from '../utils/paymentStub';
import {
  getPaymentsApiUrl,
  recoverProdamusPaymentFromUrl,
  tryRecoverReportAccess,
} from '../utils/telegramPayments';
import { useAppExitAnalytics } from '../hooks/useAppExitAnalytics';
import { sendAnalyticsEventToSheets, sendSessionToSheets } from '../utils/sheetsWebhook';

type ConsultationReturnStage = 'result' | 'full-report';

/** С какого шага открыть ResultPage (например, продажа сессии после отчёта). */
export type ResultEntryStep = 'hub' | 'session-offer';

type FaceAnswer = { faceId: number; selected: string; correct: string };

type BootState = {
  stage: AppStage;
  sessionSeed: number;
  interferenceStart: number | null;
  immediateWords: string[];
  delayedWords: string[];
  flankerTrials: TrialResult[];
  reactionSuccessful: number[];
  reactionAnticipations: number;
  stroopTrials: TrialResult[];
  participant: ParticipantProfile | null;
  studyWordList: string[];
};

function hasPendingProdamusPayment(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  for (let i = 0; i < sessionStorage.length; i++) {
    if (sessionStorage.key(i)?.startsWith('prodamus_pending_')) return true;
  }
  return false;
}

/** Стартовый экран: только intro или продолжение теста; не result/full-report. */
export function getInitialAppStage(): AppStage {
  stripPaymentQueryFromUrl();
  purgeStalePostTestProgress();
  if (isRestartBoot() || isPageReload()) {
    if (!hasPaymentReturnInUrl()) return 'corta-intro';
  }
  if (hasPaymentReturnInUrl()) return 'result';
  const raw = loadProgress();
  if (raw && shouldRestoreProgress(raw)) return raw.stage;
  return 'corta-intro';
}

function emptyBootState(): BootState {
  return {
    stage: 'corta-intro',
    sessionSeed: Date.now(),
    interferenceStart: null,
    immediateWords: [],
    delayedWords: [],
    flankerTrials: [],
    reactionSuccessful: [],
    reactionAnticipations: 0,
    stroopTrials: [],
    participant: null,
    studyWordList: [],
  };
}

function purgeStalePostTestProgress(): void {
  try {
    const raw = localStorage.getItem('alz_progress_v1');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { stage?: AppStage };
    if (parsed?.stage === 'result' || parsed?.stage === 'full-report' || parsed?.stage === 'consultation-request') {
      clearProgress();
    }
  } catch {
    /* ignore */
  }
}

function buildBootState(stage: AppStage): BootState {
  if (isRestartBoot() || isPageReload()) {
    clearProgress();
    return emptyBootState();
  }

  if (stage === 'corta-intro') return emptyBootState();

  const raw = loadProgress();
  const r = raw && shouldRestoreProgress(raw) ? raw : null;
  if (!r) return emptyBootState();

  return {
    stage,
    sessionSeed: typeof r.sessionSeed === 'number' ? r.sessionSeed : Date.now(),
    interferenceStart: r.startedAt ?? null,
    immediateWords: r.immediateWords ?? [],
    delayedWords: r.delayedWords ?? [],
    flankerTrials: r.flankerTrials ?? [],
    reactionSuccessful: r.reactionSuccessful ?? [],
    reactionAnticipations: r.reactionAnticipations ?? 0,
    stroopTrials: r.stroopTrials ?? [],
    participant: r.participant ?? null,
    studyWordList: Array.isArray(r.studyWordList) ? r.studyWordList : [],
  };
}

type AppState = {
  stage: AppStage;
  setStage: (s: AppStage) => void;
  interferenceStart: number | null;
  setInterferenceStart: (v: number | null) => void;
  immediateWords: string[];
  setImmediateWords: (v: string[]) => void;
  delayedWords: string[];
  setDelayedWords: (v: string[]) => void;
  flankerTrials: TrialResult[];
  setFlankerTrials: (v: TrialResult[]) => void;
  reactionSuccessful: number[];
  setReactionSuccessful: (v: number[]) => void;
  reactionAnticipations: number;
  setReactionAnticipations: (v: number) => void;
  stroopTrials: TrialResult[];
  setStroopTrials: (v: TrialResult[]) => void;
  faceAnswers: FaceAnswer[];
  setFaceAnswers: (v: FaceAnswer[]) => void;
  latestResult: SessionResult | null;
  setLatestResult: (r: SessionResult | null) => void;
  history: SessionResult[];
  sessionSeed: number;
  participant: ParticipantProfile | null;
  setParticipant: (v: ParticipantProfile | null) => void;
  resetSession: () => void;
  /** Перезагрузить WebView, сохранив экран и данные сессии. */
  refreshApp: () => void;
  /** Сброс на вводный экран (история тестов и оплаты отчёта сохраняются). */
  restartApp: () => void;
  beginNewAssessment: (profile: ParticipantProfile) => void;
  /** Новое прохождение теста (профиль сохраняется; отчёт — для новой сессии). */
  retakeTest: () => void;
  saveResult: (r: SessionResult) => void;
  consultationReturnTo: ConsultationReturnStage | null;
  setConsultationReturnTo: (v: ConsultationReturnStage | null) => void;
  resultEntryStep: ResultEntryStep | null;
  openResultAtStep: (step: ResultEntryStep) => void;
  clearResultEntryStep: () => void;
  studyWordList: string[];
  setStudyWordList: (v: string[]) => void;
  /** true после GET /health, если на сервере ЮKassa/Telegram оплата включена */
  serverPaymentsReady: boolean;
  /** Подэкран внутри stage (result/index, full-report/report, …) для аналитики выхода */
  analyticsScreenDetail: string | null;
  setAnalyticsScreenDetail: (detail: string | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const initialStage = getInitialAppStage();
  const b = buildBootState(initialStage);

  const [stage, setStage] = useState<AppStage>(initialStage);
  const [interferenceStart, setInterferenceStart] = useState<number | null>(b.interferenceStart);
  const [immediateWords, setImmediateWords] = useState<string[]>(b.immediateWords);
  const [delayedWords, setDelayedWords] = useState<string[]>(b.delayedWords);
  const [flankerTrials, setFlankerTrials] = useState<TrialResult[]>(b.flankerTrials);
  const [reactionSuccessful, setReactionSuccessful] = useState<number[]>(b.reactionSuccessful);
  const [reactionAnticipations, setReactionAnticipations] = useState(b.reactionAnticipations);
  const [stroopTrials, setStroopTrials] = useState<TrialResult[]>(b.stroopTrials);
  const [faceAnswers, setFaceAnswers] = useState<FaceAnswer[]>([]);
  const [history, setHistory] = useState<SessionResult[]>(() => loadHistory());
  const [latestResult, setLatestResult] = useState<SessionResult | null>(null);
  const [sessionSeed, setSessionSeed] = useState(b.sessionSeed);
  const [participant, setParticipant] = useState<ParticipantProfile | null>(b.participant);
  const [consultationReturnTo, setConsultationReturnTo] = useState<ConsultationReturnStage | null>(null);
  const [resultEntryStep, setResultEntryStep] = useState<ResultEntryStep | null>(null);
  const [analyticsScreenDetail, setAnalyticsScreenDetail] = useState<string | null>(null);
  const [studyWordList, setStudyWordList] = useState<string[]>(b.studyWordList);
  const [serverPaymentsReady, setServerPaymentsReady] = useState(false);

  useEffect(() => {
    const base = getPaymentsApiUrl();
    if (!base) return;
    void fetch(`${base.replace(/\/$/, '')}/health`)
      .then((r) => r.json())
      .then((j: { payments?: { ready?: boolean } }) => {
        setServerPaymentsReady(j?.payments?.ready === true);
      })
      .catch(() => setServerPaymentsReady(false));
  }, []);

  const openResultAtStep = useCallback((step: ResultEntryStep) => {
    setResultEntryStep(step);
    setStage('result');
  }, []);

  const clearResultEntryStep = useCallback(() => {
    setResultEntryStep(null);
  }, []);
  const sentStageEventsRef = useRef<Set<string>>(new Set());
  const sentScreenViewEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sentStageEventsRef.current = new Set();
    sentScreenViewEventsRef.current = new Set();
  }, [sessionSeed]);

  useEffect(() => {
    const boot = getInitialAppStage();
    if (hasPaymentReturnInUrl() || hasPendingProdamusPayment()) return;
    if (stage === boot) return;
    if (MID_TEST_STAGES.has(stage) && MID_TEST_STAGES.has(boot)) return;
    setStage(boot);
    if (boot === 'corta-intro') {
      setLatestResult(null);
      clearProgress();
    }
  }, []);

  useEffect(() => {
    if (stage !== 'result' && stage !== 'full-report' && stage !== 'consultation-request') return;
    if (latestResult) return;
    const session = loadSessionFromHistory(loadProgress()?.latestSessionId ?? loadLastSessionId());
    if (session) setLatestResult(session);
  }, [stage, latestResult]);

  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible') return;
      setHistory(loadHistory());
      if (stage !== 'result' && stage !== 'full-report') return;
      const session =
        latestResult ??
        loadSessionFromHistory(loadProgress()?.latestSessionId ?? loadLastSessionId());
      if (session && !latestResult) setLatestResult(session);
      if (!session?.id) return;
      const ok = await tryRecoverReportAccess(session.id);
      if (ok && stage === 'result') {
        setStage('full-report');
        return;
      }
      if (stage === 'full-report' && !ok && !isReportPaidUnlocked(session.id, serverPaymentsReady)) {
        setStage('result');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stage, latestResult?.id, serverPaymentsReady]);

  useEffect(() => {
    if (!hasPaymentReturnInUrl()) return;
    if (!arePaymentsActive(serverPaymentsReady)) return;
    const run = async () => {
      const recovery = await recoverProdamusPaymentFromUrl();
      if (!recovery) return;
      const session = loadHistory().find((h) => h.id === recovery.sessionId) ?? null;
      if (session) setLatestResult(session);
      if (recovery.product === 'full_report') {
        setStage('full-report');
        return;
      }
      if (recovery.product === 'consultation') {
        openResultAtStep('session-offer');
      }
    };
    void run();
  }, [serverPaymentsReady, openResultAtStep]);

  useEffect(() => {
    if (!MID_TEST_STAGES.has(stage)) return;
    saveProgress({
      stage,
      latestSessionId: latestResult?.id,
      startedAt: interferenceStart,
      immediateWords,
      delayedWords,
      flankerTrials,
      reactionSuccessful,
      reactionAnticipations,
      stroopTrials,
      sessionSeed,
      participant,
      studyWordList,
    });
  }, [
    stage,
    latestResult?.id,
    interferenceStart,
    immediateWords,
    delayedWords,
    flankerTrials,
    reactionSuccessful,
    reactionAnticipations,
    stroopTrials,
    sessionSeed,
    participant,
    studyWordList,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setHistory(loadHistory());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    setAnalyticsScreenDetail(null);
  }, [stage]);

  const analyticsSessionId = latestResult?.id ?? String(sessionSeed);

  useAppExitAnalytics({
    stage,
    sessionId: analyticsSessionId,
    screenDetail: analyticsScreenDetail,
    participant,
  });

  useEffect(() => {
    const key = `${sessionSeed}:${stage}`;
    if (sentStageEventsRef.current.has(key)) return;
    sentStageEventsRef.current.add(key);

    void sendAnalyticsEventToSheets({
      eventType: 'stage_reached',
      sessionId: analyticsSessionId,
      stage,
      screen: stage,
      participant: participant
        ? {
            name: participant.name,
            email: participant.email,
            phone: participant.phone,
            sex: participant.sex,
            age: participant.age,
            education: participant.education,
            pcConfidence: participant.pcConfidence,
          }
        : undefined,
    }).catch(() => {
      // Ignore analytics errors to keep UX stable.
    });
  }, [sessionSeed, stage, participant, analyticsSessionId]);

  /** Подэкраны (result/report-offer и т.д.) — отдельная строка в таблице без закрытия приложения. */
  useEffect(() => {
    if (!analyticsScreenDetail) return;
    const screen = `${stage}/${analyticsScreenDetail}`;
    const key = `${sessionSeed}:${screen}`;
    if (sentScreenViewEventsRef.current.has(key)) return;
    sentScreenViewEventsRef.current.add(key);

    void sendAnalyticsEventToSheets({
      eventType: 'screen_view',
      sessionId: analyticsSessionId,
      stage,
      screenDetail: analyticsScreenDetail,
      screen,
      participant: participant
        ? {
            name: participant.name,
            email: participant.email,
            phone: participant.phone,
            sex: participant.sex,
            age: participant.age,
            education: participant.education,
            pcConfidence: participant.pcConfidence,
          }
        : undefined,
    }).catch(() => {
      // Ignore analytics errors to keep UX stable.
    });
  }, [sessionSeed, stage, analyticsScreenDetail, analyticsSessionId, participant]);

  const resetSession = useCallback(() => {
    setStage('corta-intro');
    setInterferenceStart(null);
    setImmediateWords([]);
    setDelayedWords([]);
    setFlankerTrials([]);
    setReactionSuccessful([]);
    setReactionAnticipations(0);
    setStroopTrials([]);
    setFaceAnswers([]);
    setLatestResult(null);
    setParticipant(null);
    setConsultationReturnTo(null);
    setStudyWordList([]);
    setSessionSeed(Date.now());
    clearProgress();
    try {
      localStorage.removeItem('alz_last_session_id');
    } catch {
      /* ignore */
    }
  }, []);

  const refreshApp = useCallback(() => {
    goToIntroFresh();
  }, []);

  const restartApp = useCallback(() => {
    goToIntroFresh();
  }, []);

  const beginNewAssessment = useCallback((profile: ParticipantProfile) => {
    const seed = Date.now();
    clearProgress();
    setSessionSeed(seed);
    setParticipant(profile);
    setStudyWordList(pickStudyWordList(seed));
    setInterferenceStart(null);
    setImmediateWords([]);
    setDelayedWords([]);
    setFlankerTrials([]);
    setReactionSuccessful([]);
    setReactionAnticipations(0);
    setStroopTrials([]);
    setFaceAnswers([]);
    setLatestResult(null);
    setConsultationReturnTo(null);
    setStage('word-study');
  }, []);

  const retakeTest = useCallback(() => {
    if (participant) {
      beginNewAssessment(participant);
      return;
    }
    setStage('welcome');
  }, [participant, beginNewAssessment]);

  const saveResultFn = useCallback((result: SessionResult) => {
    setLatestResult(result);
    saveLastSessionId(result.id);
    saveSession(result);
    try {
      const prev = parseInt(localStorage.getItem('alz_completed_sessions') || '0', 10) || 0;
      localStorage.setItem('alz_completed_sessions', String(prev + 1));
      const tw = result.wordMemory.targetWords;
      if (tw?.length) {
        localStorage.setItem('alz_last_word_sig', [...tw].sort().join('|'));
      }
    } catch {
      // ignore quota / private mode
    }
    void sendSessionToSheets(result).catch(() => {
      // Ignore webhook errors to keep UX stable.
    });
    setHistory(loadHistory());
    clearProgress();
  }, []);

  const value = useMemo(
    () => ({
      stage,
      setStage,
      interferenceStart,
      setInterferenceStart,
      immediateWords,
      setImmediateWords,
      delayedWords,
      setDelayedWords,
      flankerTrials,
      setFlankerTrials,
      reactionSuccessful,
      setReactionSuccessful,
      reactionAnticipations,
      setReactionAnticipations,
      stroopTrials,
      setStroopTrials,
      faceAnswers,
      setFaceAnswers,
      latestResult,
      setLatestResult,
      history,
      sessionSeed,
      participant,
      setParticipant,
      resetSession,
      refreshApp,
      restartApp,
      beginNewAssessment,
      retakeTest,
      saveResult: saveResultFn,
      consultationReturnTo,
      setConsultationReturnTo,
      resultEntryStep,
      openResultAtStep,
      clearResultEntryStep,
      studyWordList,
      setStudyWordList,
      serverPaymentsReady,
      analyticsScreenDetail,
      setAnalyticsScreenDetail,
    }),
    [
      stage,
      interferenceStart,
      immediateWords,
      delayedWords,
      flankerTrials,
      reactionSuccessful,
      reactionAnticipations,
      stroopTrials,
      faceAnswers,
      latestResult,
      history,
      sessionSeed,
      participant,
      consultationReturnTo,
      resultEntryStep,
      openResultAtStep,
      clearResultEntryStep,
      studyWordList,
      serverPaymentsReady,
      analyticsScreenDetail,
      resetSession,
      refreshApp,
      restartApp,
      beginNewAssessment,
      retakeTest,
      saveResultFn,
    ],
  );

  useEffect(() => {
    stripPaymentQueryFromUrl();
    if (!hasPaymentReturnInUrl()) return;
    const t = window.setTimeout(() => stripPaymentQueryFromUrl(), 800);
    return () => window.clearTimeout(t);
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AppContext is missing');
  return ctx;
};
