import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppStage, ParticipantProfile, SessionResult, TrialResult } from '../types';
import { clearProgress, loadHistory, loadProgress, saveProgress, saveSession } from '../utils/storage';

type FaceAnswer = { faceId: number; selected: string; correct: string };

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
  saveResult: (r: SessionResult) => void;
};

const Ctx = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [stage, setStage] = useState<AppStage>('welcome');
  const [interferenceStart, setInterferenceStart] = useState<number | null>(null);
  const [immediateWords, setImmediateWords] = useState<string[]>([]);
  const [delayedWords, setDelayedWords] = useState<string[]>([]);
  const [flankerTrials, setFlankerTrials] = useState<TrialResult[]>([]);
  const [reactionSuccessful, setReactionSuccessful] = useState<number[]>([]);
  const [reactionAnticipations, setReactionAnticipations] = useState(0);
  const [stroopTrials, setStroopTrials] = useState<TrialResult[]>([]);
  const [faceAnswers, setFaceAnswers] = useState<FaceAnswer[]>([]);
  const [latestResult, setLatestResult] = useState<SessionResult | null>(null);
  const [history, setHistory] = useState<SessionResult[]>(() => loadHistory());
  const [sessionSeed, setSessionSeed] = useState(() => Date.now());
  const [participant, setParticipant] = useState<ParticipantProfile | null>(null);

  useEffect(() => {
    const progress = loadProgress();
    if (!progress) return;
    setStage(progress.stage);
    setInterferenceStart(progress.startedAt);
    setImmediateWords(progress.immediateWords ?? []);
    setDelayedWords(progress.delayedWords ?? []);
    setFlankerTrials(progress.flankerTrials ?? []);
    setReactionSuccessful(progress.reactionSuccessful ?? []);
    setReactionAnticipations(progress.reactionAnticipations ?? 0);
    setStroopTrials(progress.stroopTrials ?? []);
  }, []);

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
    });
  }, [stage, interferenceStart, immediateWords, delayedWords, flankerTrials, reactionSuccessful, reactionAnticipations, stroopTrials]);

  const resetSession = () => {
    setStage('welcome');
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
    setSessionSeed(Date.now());
    clearProgress();
  };

  const saveResultFn = (result: SessionResult) => {
    setLatestResult(result);
    saveSession(result);
    setHistory(loadHistory());
    clearProgress();
  };

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
      saveResult: saveResultFn,
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AppContext is missing');
  return ctx;
};
