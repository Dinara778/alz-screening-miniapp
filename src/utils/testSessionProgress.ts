import type { AppStage } from '../types';

/** Номер блока (1–5) и подпись для полоски «Задание X из 5». */
const STAGE_PROGRESS: Partial<Record<AppStage, { block: number; label: string }>> = {
  'word-study': { block: 1, label: 'Слова' },
  'word-immediate': { block: 1, label: 'Слова' },
  'word-delayed': { block: 1, label: 'Слова' },
  'flanker-instruction': { block: 2, label: 'Фланкер' },
  flanker: { block: 2, label: 'Фланкер' },
  'reaction-instruction': { block: 3, label: 'Простая реакция' },
  reaction: { block: 3, label: 'Простая реакция' },
  'interference-wait': { block: 3, label: 'Простая реакция' },
  'face-study': { block: 4, label: 'Изучение лиц' },
  'stroop-instruction': { block: 4, label: 'Струп' },
  'stroop-confirm': { block: 4, label: 'Струп' },
  stroop: { block: 4, label: 'Струп' },
  'face-test': { block: 5, label: 'Проверка лиц' },
};

export function getTestBlockProgress(stage: AppStage): { block: number; label: string } | null {
  return STAGE_PROGRESS[stage] ?? null;
}
