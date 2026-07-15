/**
 * Короткие статусы для компактных плашек доменов (экран после крупной цифры).
 * Пороги согласованы с тирами 81 / 61 / 41 в cognitiveDomainInterpretations.
 */

export type DomainChipId = 'attention' | 'speed' | 'memory' | 'variability';

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 50)));
}

/** Короткая подпись «выше нормы» / «слегка снижена» и т.п. */
export function getDomainStatusChip(domain: DomainChipId, score: number): string {
  const s = clampScore(score);

  if (domain === 'attention') {
    if (s >= 75) return 'выше нормы';
    if (s >= 61) return 'в норме';
    if (s >= 41) return 'есть колебания';
    return 'заметно снижено';
  }

  if (domain === 'speed') {
    if (s >= 75) return 'высокая';
    if (s >= 61) return 'слегка снижена';
    if (s >= 41) return 'снижена';
    return 'заметно снижена';
  }

  if (domain === 'memory') {
    if (s >= 75) return 'стабильна';
    if (s >= 61) return 'хорошая';
    if (s >= 41) return 'с перебоями';
    return 'заметно снижена';
  }

  // variability — по баллу стабильности реакции (выше = ровнее)
  if (s >= 75) return 'ровная';
  if (s >= 61) return 'умеренная';
  if (s >= 41) return 'есть колебания';
  return 'высокие колебания';
}
