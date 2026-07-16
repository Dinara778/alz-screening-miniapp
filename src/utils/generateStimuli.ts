import { TrialType } from '../types';
import { LEGACY_WORD_TARGETS, WORD_MEMORY_POOLS } from './wordPools';
import { publicAsset } from './publicAsset';
import { mulberry32, randomInt, shuffle, stimulusSubSeed } from './stimulusRng';

export { LEGACY_WORD_TARGETS, WORD_MEMORY_POOLS } from './wordPools';

const stroopKey = (t: StroopStimulus) => `${t.type}:${t.color}:${t.word}`;

function completedSessions(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem('alz_completed_sessions') || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function lastWordSig(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem('alz_last_word_sig') || '';
  } catch {
    return '';
  }
}

function lastFaceNameSig(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem('alz_last_face_name_sig') || '';
  } catch {
    return '';
  }
}

/** 5 слов для текущего прохождения: не совпадает с последним сохранённым набором, seed + анти-привыкание. */
export function pickStudyWordList(sessionSeed: number): string[] {
  const lastSig = lastWordSig();
  const habit = completedSessions();
  for (let bump = 0; bump < 400; bump += 1) {
    const rng = mulberry32(stimulusSubSeed(sessionSeed, 'word-memory', bump) ^ (habit * 0x51ed));
    const idx = randomInt(rng, WORD_MEMORY_POOLS.length);
    const picked = [...WORD_MEMORY_POOLS[idx]];
    const sig = [...picked].sort().join('|');
    if (sig !== lastSig) return picked;
  }
  const rng = mulberry32(stimulusSubSeed(sessionSeed, 'word-memory-fallback'));
  return [...WORD_MEMORY_POOLS[randomInt(rng, WORD_MEMORY_POOLS.length)]];
}

export type FlankerStimulus = { type: TrialType; arrows: string; correct: '<' | '>' };

export const createFlankerTrials = (sessionSeed: number): FlankerStimulus[] => {
  const rng = mulberry32(stimulusSubSeed(sessionSeed, 'flanker'));
  const habit = completedSessions();
  const dirs = shuffle(
    [...Array(5).fill('<'), ...Array(5).fill('>')],
    rng,
  ) as ('<' | '>')[];
  const congruent: FlankerStimulus[] = dirs.map((dir) => ({
    type: 'congruent' as const,
    arrows: dir.repeat(5),
    correct: dir,
  }));
  const incDirs = shuffle(
    [...Array(5).fill('<'), ...Array(5).fill('>')],
    rng,
  ) as ('<' | '>')[];
  const incongruent: FlankerStimulus[] = incDirs.map((center) => {
    const flank = center === '<' ? '>' : '<';
    return {
      type: 'incongruent' as const,
      arrows: `${flank}${flank}${center}${flank}${flank}`,
      correct: center,
    };
  });
  let trials = shuffle([...congruent, ...incongruent], rng);
  for (let pass = 0; pass < Math.min(5, 1 + Math.floor(habit / 2)); pass += 1) {
    trials = shuffle(trials, rng);
  }
  for (let iter = 0; iter < trials.length * 8; iter += 1) {
    let fixedAll = true;
    for (let i = 0; i < trials.length - 1; i += 1) {
      if (trials[i].arrows === trials[i + 1].arrows) {
        fixedAll = false;
        const forbidden = trials[i].arrows;
        const swapCandidates: number[] = [];
        for (let j = 0; j < trials.length; j += 1) {
          if (j === i + 1) continue;
          if (trials[j].arrows === forbidden) continue;
          swapCandidates.push(j);
        }
        if (swapCandidates.length === 0) continue;
        const j = swapCandidates[randomInt(rng, swapCandidates.length)];
        [trials[i + 1], trials[j]] = [trials[j], trials[i + 1]];
        break;
      }
    }
    if (fixedAll) break;
  }
  return trials;
};

export type StroopInk = 'red' | 'blue' | 'green';

export type StroopStimulus = {
  type: TrialType;
  word: string;
  color: StroopInk;
  correct: StroopInk;
};

const COLOR_WORD: Record<StroopInk, string> = {
  red: 'КРАСНЫЙ',
  blue: 'СИНИЙ',
  green: 'ЗЕЛЕНЫЙ',
};

const COLORS: StroopInk[] = ['red', 'blue', 'green'];

export const createStroopTrials = (sessionSeed: number): StroopStimulus[] => {
  const rng = mulberry32(stimulusSubSeed(sessionSeed, 'stroop'));
  const habit = completedSessions();

  const multiset: StroopInk[] = [
    'red',
    'red',
    'red',
    'red',
    'blue',
    'blue',
    'blue',
    'green',
    'green',
    'green',
  ];
  const congruentColors = shuffle(multiset, rng);
  const congruent: StroopStimulus[] = congruentColors.map((c) => ({
    type: 'congruent',
    word: COLOR_WORD[c],
    color: c,
    correct: c,
  }));

  const incongPairs: { ink: StroopInk; word: StroopInk }[] = [];
  for (const ink of COLORS) {
    for (const w of COLORS) {
      if (ink !== w) incongPairs.push({ ink, word: w });
    }
  }
  const incongruent: StroopStimulus[] = [];
  while (incongruent.length < 10) {
    const p = incongPairs[randomInt(rng, incongPairs.length)];
    incongruent.push({
      type: 'incongruent',
      word: COLOR_WORD[p.word],
      color: p.ink,
      correct: p.ink,
    });
  }

  const neutral: StroopStimulus[] = [];
  while (neutral.length < 10) {
    const ink = COLORS[randomInt(rng, COLORS.length)];
    let wordColor = COLORS[randomInt(rng, COLORS.length)];
    if (wordColor === ink) wordColor = COLORS[(COLORS.indexOf(ink) + 1) % 3];
    neutral.push({
      type: 'neutral',
      word: COLOR_WORD[wordColor],
      color: ink,
      correct: ink,
    });
  }

  let trials = shuffle([...congruent, ...incongruent, ...neutral], rng);
  for (let pass = 0; pass < Math.min(6, 2 + Math.floor(habit / 2)); pass += 1) {
    trials = shuffle(trials, rng);
  }

  for (let iter = 0; iter < 100; iter += 1) {
    let bad = false;
    for (let i = 0; i < trials.length - 1; i += 1) {
      if (stroopKey(trials[i]) === stroopKey(trials[i + 1])) {
        bad = true;
        const span = trials.length - i - 2;
        if (span <= 0) break;
        const swapWith = i + 2 + randomInt(rng, span);
        [trials[i + 1], trials[swapWith]] = [trials[swapWith], trials[i + 1]];
        break;
      }
    }
    if (!bad) break;
  }

  return trials;
};

export type FaceStimulus = { id: number; label: string; image: string; correctName: string; options: string[] };

const FACE_NAME_POOL = [
  'Алексей',
  'Андрей',
  'Антон',
  'Борис',
  'Виктор',
  'Владимир',
  'Георгий',
  'Даниил',
  'Дмитрий',
  'Евгений',
  'Иван',
  'Игорь',
  'Кирилл',
  'Максим',
  'Михаил',
  'Никита',
  'Олег',
  'Павел',
  'Роман',
  'Сергей',
] as const;

export const createFaceTrials = (sessionSeed: number): FaceStimulus[] => {
  const baseFaces = [
    { id: 1, label: 'Лицо 1', image: publicAsset('/faces/man-1.svg') },
    { id: 2, label: 'Лицо 2', image: publicAsset('/faces/man-2.svg') },
    { id: 3, label: 'Лицо 3', image: publicAsset('/faces/man-3.svg') },
  ];
  const previousSig = lastFaceNameSig();
  const previousNameSetSig = previousSig
    .split('|')
    .map((p) => p.split(':')[1] ?? '')
    .filter(Boolean)
    .sort()
    .join('|');
  const habit = completedSessions();

  /** Варианты ответа — только из трёх имён этой сессии (те же, что на изучении). */
  const pickOptions = (correctName: string, sessionNames: readonly string[], rng: () => number): string[] => {
    const distractors = sessionNames.filter((n) => n !== correctName);
    return shuffle([correctName, ...distractors], rng);
  };

  for (let bump = 0; bump < 120; bump += 1) {
    const rng = mulberry32(stimulusSubSeed(sessionSeed, 'face-name', bump) ^ (habit * 0x9e37));
    const sessionNames = shuffle([...FACE_NAME_POOL], rng).slice(0, baseFaces.length);
    const assignedNames = shuffle([...sessionNames], rng);
    const mapped = baseFaces.map((face, idx) => ({
      id: face.id,
      label: face.label,
      image: face.image,
      correctName: assignedNames[idx],
    }));
    const nameSetSig = [...sessionNames].sort().join('|');
    const sig = mapped
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((f) => `${f.id}:${f.correctName}`)
      .join('|');
    if (sig === previousSig || nameSetSig === previousNameSetSig) continue;
    return shuffle(mapped, rng).map((f) => ({
      ...f,
      options: pickOptions(f.correctName, assignedNames, rng),
    }));
  }

  const fallbackRng = mulberry32(stimulusSubSeed(sessionSeed, 'face-name-fallback'));
  const assignedNames = shuffle([...FACE_NAME_POOL], fallbackRng);
  const fallback = baseFaces.map((face, idx) => ({
    id: face.id,
    label: face.label,
    image: face.image,
    correctName: assignedNames[idx],
  }));
  return shuffle(fallback, fallbackRng).map((f) => ({
    ...f,
    options: pickOptions(f.correctName, assignedNames, fallbackRng),
  }));
};

/** Задержка перед сигналом простой реакции, мс: [1000, 3000], без близких повторов к последним. */
export function nextReactionStimulusDelayMs(sessionSeed: number, attemptIndex: number, recentDelays: number[]): number {
  const rng = mulberry32(stimulusSubSeed(sessionSeed, 'reaction-delay', attemptIndex));
  for (let tries = 0; tries < 40; tries += 1) {
    const d = Math.round(1000 + rng() * 2000);
    const tooClose = recentDelays.some((p) => Math.abs(p - d) < 140);
    if (!tooClose) return d;
  }
  return Math.round(1000 + rng() * 2000);
}

/** Случайная пауза перед стартом очередной пробы фланкера, мс (около 300–800). */
export function nextFlankerPrepDelayMs(sessionSeed: number, trialIndex: number): number {
  const rng = mulberry32(stimulusSubSeed(sessionSeed, 'flanker-prep', trialIndex));
  return Math.round(300 + rng() * 500);
}
