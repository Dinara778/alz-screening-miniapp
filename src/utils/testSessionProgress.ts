import type { AppStage } from '../types';

/** Номер блока (1–5) и подпись для полоски «Задание X из 5». */
const BLOCKS: { block: number; label: string; stages: readonly AppStage[] }[] = [
  { block: 1, label: 'Слова', stages: ['word-study', 'word-immediate', 'word-delayed'] },
  { block: 2, label: 'Фланкер', stages: ['flanker-instruction', 'flanker'] },
  { block: 3, label: 'Простая реакция', stages: ['reaction-instruction', 'reaction', 'interference-wait'] },
  {
    block: 4,
    label: 'Лица и отвлечение',
    stages: ['face-study', 'stroop-instruction', 'stroop'],
  },
  { block: 5, label: 'Проверка лиц', stages: ['face-test'] },
];

export function getTestBlockProgress(stage: AppStage): { block: number; label: string } | null {
  for (const b of BLOCKS) {
    if (b.stages.includes(stage)) return { block: b.block, label: b.label };
  }
  return null;
}
