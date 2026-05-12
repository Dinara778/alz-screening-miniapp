export type TrialType = 'congruent' | 'incongruent' | 'neutral';

/** Ключи доменов когнитивного профиля (индекс, отчёты, PDF). */
export type CognitiveDomainKey =
  | 'attentionStability'
  | 'reactionSpeed'
  | 'reactionStability'
  | 'cognitiveFlexibility'
  | 'informationRetention';

export type TrialResult = {
  type: TrialType;
  rt: number | null;
  correct: boolean;
  timedOut?: boolean;
};

export type WordMemoryResult = {
  immediateScore: number;
  delayedScore: number;
  immediateWords: string[];
  delayedWords: string[];
  /** Слова, которые нужно было запомнить (для подсчёта и истории). У старых сессий может отсутствовать. */
  targetWords?: string[];
  redFlag: boolean;
};

export type FlankerResult = {
  trials: TrialResult[];
  avgCongruentRt: number;
  avgIncongruentRt: number;
  incongruentCv: number;
  incongruentAccuracy: number;
  redFlag: boolean;
};

export type ReactionResult = {
  successfulRTs: number[];
  medianRt: number;
  cv: number;
  anticipations: number;
  redFlag: boolean;
};

export type StroopResult = {
  trials: TrialResult[];
  incongruentErrorRate: number;
  incongruentCv: number;
  redFlag: boolean;
};

export type FaceNameResult = {
  score: number;
  answers: { faceId: number; selected: string; correct: string }[];
  redFlag: boolean;
};

export type ParticipantProfile = {
  name: string;
  email: string;
  phone: string;
  sex: 'Женский' | 'Мужской' | 'Другой';
  age: number;
  education: string;
  educationYears: number;
  pcConfidence: 1 | 2 | 3 | 4 | 5;
};

export type SessionResult = {
  id: string;
  date: string;
  flags: number;
  status:
    | 'Когнитивная система работает стабильно'
    | 'Нестабильность под нагрузкой'
    | 'Выраженная когнитивная перегрузка';
  participant: ParticipantProfile;
  wordMemory: WordMemoryResult;
  flanker: FlankerResult;
  reaction: ReactionResult;
  stroop: StroopResult;
  faceName: FaceNameResult;
};

export type AppStage =
  | 'corta-intro'
  | 'welcome'
  | 'history'
  | 'word-study'
  | 'word-immediate'
  | 'flanker-instruction'
  | 'flanker'
  | 'reaction-instruction'
  | 'reaction'
  | 'interference-wait'
  | 'word-delayed'
  | 'face-study'
  | 'stroop-instruction'
  | 'stroop'
  | 'face-test'
  | 'result'
  | 'full-report'
  | 'consultation-request';

export type SavedProgress = {
  stage: AppStage;
  startedAt: number | null;
  immediateWords?: string[];
  delayedWords?: string[];
  flankerTrials?: TrialResult[];
  reactionSuccessful?: number[];
  reactionAnticipations?: number;
  stroopTrials?: TrialResult[];
};
