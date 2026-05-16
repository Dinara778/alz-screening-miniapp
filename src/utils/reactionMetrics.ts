import { cv } from './metrics';

/** Ниже порога RT считаются артефактом (0 мс, сбой таймера) и не участвуют в метриках. */
export const MIN_VALID_REACTION_RT_MS = 80;

export type SanitizedReactionRts = {
  cleaned: number[];
  droppedInvalid: number;
};

export const sanitizeReactionRts = (raw: number[] | undefined | null): SanitizedReactionRts => {
  const list = raw ?? [];
  const cleaned = list.filter((rt) => Number.isFinite(rt) && rt >= MIN_VALID_REACTION_RT_MS);
  return { cleaned, droppedInvalid: list.length - cleaned.length };
};

/** CV по RT с отсечением крайних 10% при достаточной выборке — меньше «ложного нуля» от единичных выбросов. */
export const robustReactionCvPercent = (cleaned: number[]): number => {
  if (!cleaned.length) return 0;
  if (cleaned.length < 8) return cv(cleaned);
  const sorted = [...cleaned].sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(sorted.length * 0.1));
  return cv(sorted.slice(trim, sorted.length - trim));
};

/**
 * Балл домена «стабильность реакции» (0–100).
 * Линейная формула 100 − CV×1.1 − anticipations×6 слишком часто давала 0 при валидных данных.
 */
export const reactionStabilityDomainScore = (cvPercent: number, anticipations: number): number => {
  if (!Number.isFinite(cvPercent) || cvPercent < 0) return 50;
  const cvPenalty = Math.min(70, Math.max(0, (cvPercent - 15) * 1.15));
  const antPenalty = Math.min(24, Math.max(0, anticipations) * 2);
  const raw = 100 - cvPenalty - antPenalty;
  return Math.max(12, Math.min(96, Math.round(raw)));
};
