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
