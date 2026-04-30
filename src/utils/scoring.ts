import { FaceNameResult, FlankerResult, ReactionResult, SessionResult, StroopResult, TrialResult, WordMemoryResult } from '../types';
import { avg, cv, median } from './metrics';

export const normalizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((w) => w.trim())
    .filter(Boolean);

export const scoreWordMemory = (immediateWords: string[], delayedWords: string[]): WordMemoryResult => {
  const target = ['лес', 'хлеб', 'окно', 'звонок', 'чайка'];
  const exactScore = (words: string[]) => target.filter((w) => words.includes(w)).length;
  const immediateScore = exactScore(immediateWords);
  const delayedScore = exactScore(delayedWords);
  const redFlag = delayedScore < 3 || immediateScore - delayedScore >= 3;
  return { immediateScore, delayedScore, immediateWords, delayedWords, redFlag };
};

export const scoreFlanker = (trials: TrialResult[]): FlankerResult => {
  const congruent = trials.filter((t) => t.type === 'congruent' && t.rt !== null && t.correct).map((t) => t.rt as number);
  const incongruentCorrect = trials.filter((t) => t.type === 'incongruent' && t.rt !== null && t.correct).map((t) => t.rt as number);
  const incongruentAll = trials.filter((t) => t.type === 'incongruent');
  const correctInc = incongruentAll.filter((t) => t.correct).length;
  const accuracy = incongruentAll.length ? (correctInc / incongruentAll.length) * 100 : 0;
  const incongruentCv = cv(incongruentCorrect);
  const redFlag = accuracy < 70 || incongruentCv > 40;
  return {
    trials,
    avgCongruentRt: avg(congruent),
    avgIncongruentRt: avg(incongruentCorrect),
    incongruentCv,
    incongruentAccuracy: accuracy,
    redFlag,
  };
};

export const scoreReaction = (successfulRTs: number[], anticipations: number): ReactionResult => {
  const cvVal = cv(successfulRTs);
  return {
    successfulRTs,
    medianRt: median(successfulRTs),
    cv: cvVal,
    anticipations,
    redFlag: cvVal > 35 || anticipations > 3,
  };
};

export const scoreStroop = (trials: TrialResult[]): StroopResult => {
  const incongruent = trials.filter((t) => t.type === 'incongruent');
  const incCorrectRTs = incongruent.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number);
  const errors = incongruent.filter((t) => !t.correct).length;
  const errorRate = incongruent.length ? (errors / incongruent.length) * 100 : 0;
  const cvInc = cv(incCorrectRTs);
  return {
    trials,
    incongruentErrorRate: errorRate,
    incongruentCv: cvInc,
    redFlag: errorRate > 25 || cvInc > 45,
  };
};

export const scoreFaceName = (score: number, answers: FaceNameResult['answers']): FaceNameResult => ({
  score,
  answers,
  redFlag: score <= 1,
});

export const buildStatus = (flags: number): SessionResult['status'] => {
  if (flags === 0) return 'Нет признаков';
  if (flags <= 2) return 'Умеренный риск, стабильные реакции';
  if (flags === 3) return 'Риск выше среднего';
  return 'Высокий риск';
};
