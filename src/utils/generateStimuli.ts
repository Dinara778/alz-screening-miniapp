import { TrialType } from '../types';

export const WORDS = ['лес', 'хлеб', 'окно', 'звонок', 'чайка'];

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export type FlankerStimulus = { type: TrialType; arrows: string; correct: '<' | '>' };

export const createFlankerTrials = (): FlankerStimulus[] => {
  const congruent: FlankerStimulus[] = Array.from({ length: 10 }, (_, i) => {
    const dir = i % 2 === 0 ? '<' : '>';
    return { type: 'congruent', arrows: dir.repeat(5), correct: dir as '<' | '>' };
  });
  const incongruent: FlankerStimulus[] = Array.from({ length: 10 }, (_, i) => {
    const center = i % 2 === 0 ? '<' : '>';
    const flank = center === '<' ? '>' : '<';
    return { type: 'incongruent', arrows: `${flank}${flank}${center}${flank}${flank}`, correct: center as '<' | '>' };
  });
  return shuffle([...congruent, ...incongruent]);
};

export type StroopStimulus = {
  type: TrialType;
  word: 'КРАСНЫЙ' | 'СИНИЙ' | 'ЗЕЛЕНЫЙ';
  color: 'red' | 'blue' | 'green';
  correct: 'red' | 'blue' | 'green';
};

export const createStroopTrials = (): StroopStimulus[] => {
  const colors: Array<'red' | 'blue' | 'green'> = ['red', 'blue', 'green'];
  const colorWord: Record<'red' | 'blue' | 'green', 'КРАСНЫЙ' | 'СИНИЙ' | 'ЗЕЛЕНЫЙ'> = {
    red: 'КРАСНЫЙ',
    blue: 'СИНИЙ',
    green: 'ЗЕЛЕНЫЙ',
  };
  const congruent = Array.from({ length: 10 }, (_, i) => {
    const c = colors[i % 3];
    return { type: 'congruent' as const, word: colorWord[c], color: c, correct: c };
  });
  const incongruent = Array.from({ length: 10 }, (_, i) => {
    const textColor = colors[i % 3];
    const wordColor = colors[(i + 1) % 3];
    return { type: 'incongruent' as const, word: colorWord[wordColor], color: textColor, correct: textColor };
  });
  const neutral = Array.from({ length: 10 }, (_, i) => {
    const c = colors[i % 3];
    const wordColor = colors[(i + 2) % 3];
    return { type: 'neutral' as const, word: colorWord[wordColor], color: c, correct: c };
  });
  return shuffle([...congruent, ...incongruent, ...neutral]);
};

export type FaceStimulus = { id: number; label: string; image: string; correctName: string; options: string[] };

export const createFaceTrials = (): FaceStimulus[] => {
  const base = [
    { id: 1, label: 'Лицо 1', image: '/faces/man-1.svg', correctName: 'Михаил' },
    { id: 2, label: 'Лицо 2', image: '/faces/man-2.svg', correctName: 'Иван' },
    { id: 3, label: 'Лицо 3', image: '/faces/man-3.svg', correctName: 'Дмитрий' },
  ];
  const names = ['Михаил', 'Иван', 'Дмитрий'];
  return shuffle(base).map((f) => ({ ...f, options: shuffle(names) }));
};
