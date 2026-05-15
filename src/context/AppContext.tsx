import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppStage, ParticipantProfile, SessionResult, TrialResult } from '../types';
import {
  clearProgress,
  isPageReload,
  loadHistory,
  saveProgress,
  saveSession,
  shouldRestoreProgress,
  loadProgress,
} from '../utils/storage';
import { pickStudyWordList } from '../utils/generateStimuli';
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

function buildBootState(): BootState {
  const reloaded = isPageReload();
  if (reloaded) clearProgress();
  const raw = reloaded ? null : loadProgress();
  const r = shouldRestoreProgress(raw) ? raw : null;
  return {
    stage: r?.stage ?? 'corta-intro',
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
  beginNewAssessment: (profile: ParticipantProfile) => void;
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
  const [latestResult, setLatestResult] = useState<SessionResult | null>(null);
  const [history, setHistory] = useState<SessionResult[]>(() => loadHistory());
  const [sessionSeed, setSessionSeed] = useState(b.sessionSeed);
  const [participant, setParticipant] = useState<ParticipantProfile | null>(b.participant);
  const [consultationReturnTo, setConsultationReturnTo] = useState<ConsultationReturnStage | null>(null);
  const [studyWordList, setStudyWordList] = useState<string[]>(b.studyWordList);
  const sentStageEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sentStageEventsRef.current = new Set();
  }, [sessionSeed]);

  useEffect(() => {
    saveProgress({
      stage,
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

  const saveResultFn = useCallback((result: SessionResult) => {
    setLatestResult(result);
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
      beginNewAssessment,
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
      beginNewAssessment,
      saveResultFn,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AppContext is missing');
  return ctx;
};
