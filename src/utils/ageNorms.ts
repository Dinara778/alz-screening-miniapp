import type { ParticipantProfile } from '../types';

export type AgeSex = {
  age: number;
  sex: 'male' | 'female';
};

/** Возраст из профиля; без валидного возраста — без возрастной коррекции. */
export function resolveAgeSex(participant?: ParticipantProfile | null): AgeSex | null {
  const age = Number(participant?.age);
  if (!Number.isFinite(age) || age < 18 || age > 100) return null;
  return {
    age: Math.round(age),
    sex: participant?.sex === 'Мужской' ? 'male' : 'female',
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Нормы отсроченной памяти (из adjustTestScores), шкала ~15 слов → наша шкала 0–5.
 * Образование не учитывается.
 */
function delayedRecallNorms(age: number, sex: AgeSex['sex']): { mean: number; sd: number } {
  let mean15: number;
  let sd15: number;
  if (age <= 40) {
    mean15 = sex === 'female' ? 12.14 : 11.95;
    sd15 = sex === 'female' ? 1.8 : 2.6;
  } else if (age <= 59) {
    mean15 = sex === 'female' ? 11.54 : 10.44;
    sd15 = sex === 'female' ? 2.5 : 3.2;
  } else {
    mean15 = sex === 'female' ? 10.53 : 9.57;
    sd15 = sex === 'female' ? 2.9 : 3.4;
  }
  const scale = 5 / 15;
  return { mean: mean15 * scale, sd: Math.max(0.35, sd15 * scale) };
}

/**
 * Нормы лиц–имён (середина edu-банок из adjustTestScores), шкала 0–3.
 * Образование намеренно усреднено.
 */
function faceNameNorms(age: number): { mean: number; sd: number } {
  if (age < 50) return { mean: 2.6, sd: 0.6 };
  if (age <= 65) return { mean: 2.2, sd: 0.7 };
  return { mean: 1.75, sd: 0.8 };
}

/** Перенос сырья в «эквивалент» относительно референсной возрастной группы. */
function mapToReferenceScale(
  raw: number,
  ageMean: number,
  ageSd: number,
  refMean: number,
  refSd: number,
  min: number,
  max: number,
): number {
  const z = (raw - ageMean) / Math.max(ageSd, 0.01);
  return clamp(refMean + z * refSd, min, max);
}

/** RT → эквивалент в «возрасте 30» (старше — чуть «прощается» медлительность). */
export function ageAdjustReactionMedianMs(
  medianRtMs: number,
  age: number,
  sex: AgeSex['sex'],
): number {
  if (!Number.isFinite(medianRtMs) || medianRtMs <= 0) return medianRtMs;
  const maleBonus = sex === 'male' ? 10 : 0;
  return Math.max(80, medianRtMs - (age - 30) * 1.5 - maleBonus);
}

/** CV → эквивалент в «возрасте 30». */
export function ageAdjustCvPercent(cvPercent: number, age: number, perYear: number): number {
  if (!Number.isFinite(cvPercent)) return cvPercent;
  return Math.max(0, cvPercent - (age - 30) * perYear);
}

/**
 * Ошибки Струпа (%): после 50 лет ожидается чуть больше ошибок
 * (~0.2 ошибки/год на ~10 пробах ≈ 2 п.п./год).
 */
export function ageAdjustStroopErrorRate(errorRatePercent: number, age: number): number {
  if (!Number.isFinite(errorRatePercent)) return errorRatePercent;
  const yearsOver50 = age > 50 ? age - 50 : 0;
  return Math.max(0, errorRatePercent - yearsOver50 * 2);
}

/** Отсроченные слова 0–5 → age-normed в шкалу «как в 40 лет». */
export function ageNormWordDelayed(raw: number, age: number, sex: AgeSex['sex']): number {
  const own = delayedRecallNorms(age, sex);
  const ref = delayedRecallNorms(40, sex);
  return mapToReferenceScale(raw, own.mean, own.sd, ref.mean, ref.sd, 0, 5);
}

/** Лица 0–3 → age-normed; женщинам лёгкий бонус к Z (+0.1), как в adjustTestScores. */
export function ageNormFaceScore(raw: number, age: number, sex: AgeSex['sex']): number {
  const own = faceNameNorms(age);
  const ref = faceNameNorms(40);
  let z = (raw - own.mean) / Math.max(own.sd, 0.01);
  if (sex === 'female') z += 0.1;
  return clamp(ref.mean + z * ref.sd, 0, 3);
}

export type DomainMetricInputs = {
  reactionMedianRt: number;
  reactionCv: number;
  flankerIncongruentAccuracy: number;
  flankerIncongruentCv: number;
  stroopInterferenceMs: number;
  stroopIncongruentErrorRate: number;
  stroopIncongruentCv: number;
  wordDelayedScore: number;
  wordDelta: number;
  faceNameScore: number;
};

/** Возрастная коррекция только для доменов/индекса. Образование не используется. */
export function applyAgeNormsToDomainMetrics(
  metrics: DomainMetricInputs,
  ageSex: AgeSex | null,
): DomainMetricInputs {
  if (!ageSex) return metrics;
  const { age, sex } = ageSex;
  return {
    ...metrics,
    reactionMedianRt: ageAdjustReactionMedianMs(metrics.reactionMedianRt, age, sex),
    reactionCv: ageAdjustCvPercent(metrics.reactionCv, age, 0.2),
    flankerIncongruentCv: ageAdjustCvPercent(metrics.flankerIncongruentCv, age, 0.05),
    stroopIncongruentErrorRate: ageAdjustStroopErrorRate(metrics.stroopIncongruentErrorRate, age),
    wordDelayedScore: ageNormWordDelayed(metrics.wordDelayedScore, age, sex),
    faceNameScore: ageNormFaceScore(metrics.faceNameScore, age, sex),
  };
}
