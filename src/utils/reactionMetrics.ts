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

/** Балл домена «стабильность реакции» (0–100): база 60 при CV>35%, −10 при anticipations>3. */
export const reactionStabilityDomainScore = (cvPercent: number, anticipations: number): number => {
  if (!Number.isFinite(cvPercent) || cvPercent < 0) return 50;
  let base = cvPercent > 35 ? 60 : 100;
  if (anticipations > 3) base -= 10;
  return Math.max(12, Math.min(100, Math.round(base)));
};
