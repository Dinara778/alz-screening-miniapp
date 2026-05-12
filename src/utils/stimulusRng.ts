/** Детерминированный RNG для стимулов (воспроизводимость в рамках одной сессии + вариативность между сессиями). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/** Смешивает sessionSeed, число завершённых сессий и метку блока — разные подпоследовательности не коррелируют. */
export function stimulusSubSeed(sessionSeed: number, label: string, salt = 0): number {
  const completed =
    typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('alz_completed_sessions') || '0', 10) || 0 : 0;
  let h = (sessionSeed ^ completed * 0x9e3779b9 ^ salt) >>> 0;
  for (let i = 0; i < label.length; i += 1) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b);
  }
  return h >>> 0;
}
