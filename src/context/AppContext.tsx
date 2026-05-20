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
  shouldClearProgressOnReload,
  shouldRestoreProgress,
  loadProgress,
} from '../utils/storage';
import { reloadApplication, restartApplicationToIntro, stripPaymentQueryFromUrl } from '../utils/appReload';
import { isReportPaidUnlocked } from '../utils/telegramPayments';
import { pickStudyWordList } from '../utils/generateStimuli';
import {
  findPaidReportSessionId,
  recoverProdamusPaymentFromUrl,
  tryRecoverReportAccess,
} from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets, sendSessionToSheets } from '../utils/sheetsWebhook';

type ConsultationReturnStage = 'result' | 'full-report';

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

function resolveInitialStage(): AppStage {
  if (hasPaymentReturnInUrl()) return 'result';
  return 'corta-intro';
}

function resolveBootStage(r: ReturnType<typeof loadProgress>): AppStage {
  if (hasPaymentReturnInUrl()) return 'result';
  if (r && shouldRestoreProgress(r)) {
    if (r.stage === 'full-report') {
      const sid = r.latestSessionId ?? loadLastSessionId();
      if (sid && isReportPaidUnlocked(sid)) return 'full-report';
      return 'result';
    }
    return r.stage;
  }
  const lastId = loadLastSessionId();
  if (lastId && loadSessionFromHistory(lastId)) return 'result';
  return resolveInitialStage();
}

function resolveBootLatestResult(stage: AppStage): SessionResult | null {
  if (stage === 'full-report') {
    const paidId = findPaidReportSessionId();
    if (paidId) return loadSessionFromHistory(paidId);
  }
  const prog = loadProgress();
  const sid =
    stage === 'result' || stage === 'full-report' || stage === 'consultation-request'
      ? (prog?.latestSessionId ?? loadLastSessionId())
      : loadLastSessionId();
  return loadSessionFromHistory(sid);
}

function buildBootState(): BootState {
  if (isRestartBoot()) {
    clearProgress();
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

  const reloaded = isPageReload();
  const rawBeforeClear = loadProgress();
  if (reloaded && shouldClearProgressOnReload(rawBeforeClear)) {
    clearProgress();
  }
  const raw = loadProgress();
  const r = shouldRestoreProgress(raw) ? raw : null;
  const stage = resolveBootStage(r);
  return {
    stage,
    sessionSeed: typeof r?.sessionSeed === 'number' ? r.sessionSeed : Date.now(),
    interferenceStart: r?.startedAt ?? null,
    immediateWords: r?.immediateWords ?? [],
    delayedWords: r?.delayedWords ?? [],
    flankerTrials: r?.flankerTrials ?? [],
    reactionSuccessful: r?.reactionSuccessful ?? [],
    reactionAnticipations: r?.reactionAnticipations ?? 0,
    stroopTrials: r?.stroopTrials ?? [],
    participant: r?.participant ?? null,
    studyWordList: Array.isArray(r?.studyWordList) ? r.studyWordList : [],
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
  studyWordList: string[];
  setStudyWordList: (v: string[]) => void;
};

const Ctx = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const bootRef = useRef<BootState | null>(null);
  if (bootRef.current === null) {
    bootRef.current = buildBootState();
  }
  const b = bootRef.current;

  const [stage, setStage] = useState<AppStage>(b.stage);
  const [interferenceStart, setInterferenceStart] = useState<number | null>(b.interferenceStart);
  const [immediateWords, setImmediateWords] = useState<string[]>(b.immediateWords);
  const [delayedWords, setDelayedWords] = useState<string[]>(b.delayedWords);
  const [flankerTrials, setFlankerTrials] = useState<TrialResult[]>(b.flankerTrials);
  const [reactionSuccessful, setReactionSuccessful] = useState<number[]>(b.reactionSuccessful);
  const [reactionAnticipations, setReactionAnticipations] = useState(b.reactionAnticipations);
  const [stroopTrials, setStroopTrials] = useState<TrialResult[]>(b.stroopTrials);
  const [faceAnswers, setFaceAnswers] = useState<FaceAnswer[]>([]);
  const [history, setHistory] = useState<SessionResult[]>(() => loadHistory());
  const [latestResult, setLatestResult] = useState<SessionResult | null>(() =>
    resolveBootLatestResult(b.stage),
  );
  const [sessionSeed, setSessionSeed] = useState(b.sessionSeed);
  const [participant, setParticipant] = useState<ParticipantProfile | null>(b.participant);
  const [consultationReturnTo, setConsultationReturnTo] = useState<ConsultationReturnStage | null>(null);
  const [studyWordList, setStudyWordList] = useState<string[]>(b.studyWordList);
  const sentStageEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sentStageEventsRef.current = new Set();
  }, [sessionSeed]);

  useEffect(() => {
    const run = async () => {
      const recovery = await recoverProdamusPaymentFromUrl();
      if (recovery) {
        const session = loadHistory().find((h) => h.id === recovery.sessionId) ?? null;
        if (session) setLatestResult(session);
        if (recovery.product === 'full_report') {
          setStage('full-report');
          return;
        }
        if (recovery.product === 'consultation') {
          setConsultationReturnTo('full-report');
          setStage('consultation-request');
          return;
        }
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible') return;
      setHistory(loadHistory());
      if (stage !== 'result' && stage !== 'full-report') return;
      if (latestResult?.id) return;
      const session = resolveBootLatestResult(stage);
      if (session) setLatestResult(session);
      if (stage === 'full-report' && session?.id) {
        const ok = await tryRecoverReportAccess(session.id);
        if (!ok && !isReportPaidUnlocked(session.id)) setStage('result');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stage, latestResult?.id]);


  useEffect(() => {
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
    const key = `${sessionSeed}:${stage}`;
    if (sentStageEventsRef.current.has(key)) return;
    sentStageEventsRef.current.add(key);

    void sendAnalyticsEventToSheets({
      eventType: 'stage_reached',
      sessionId: String(sessionSeed),
      stage,
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
  }, [sessionSeed, stage, participant]);

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
    reloadApplication();
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

  const restartApp = useCallback(() => {
    clearProgress();
    restartApplicationToIntro();
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
    saveProgress({
      stage: 'result',
      latestSessionId: result.id,
      startedAt: null,
      immediateWords: [],
      delayedWords: [],
      flankerTrials: [],
      reactionSuccessful: [],
      reactionAnticipations: 0,
      stroopTrials: [],
      sessionSeed,
      participant: result.participant,
      studyWordList: [],
    });
  }, [sessionSeed]);

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
      studyWordList,
      setStudyWordList,
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
      studyWordList,
      resetSession,
      refreshApp,
      restartApp,
      beginNewAssessment,
      retakeTest,
      saveResultFn,
    ],
  );

  useEffect(() => {
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
