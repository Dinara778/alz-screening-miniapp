import type { SessionResult, TrialResult } from '../types';
import { scoreFaceName, scoreFlanker, scoreReaction, scoreStroop, scoreWordMemory } from '../utils/scoring';

export const SYNTH_PARTICIPANT: SessionResult['participant'] = {
  name: 'Synthetic',
  email: '',
  phone: '',
  sex: 'Другой',
  age: 40,
  education: '',
  educationYears: 12,
  pcConfidence: 3,
};

const TARGET_WORDS = ['яблоко', 'дом', 'река', 'снег', 'книга'];

/** 10 неконгруэнтных + 10 конгруэнтных (как в приложении), все корректные ответы. */
export function makeFlankerTrials(incRts: number[], congRts: number[], incCorrect = true): TrialResult[] {
  const inc: TrialResult[] = incRts.map((rt) => ({
    type: 'incongruent' as const,
    rt,
    correct: incCorrect,
  }));
  const cong: TrialResult[] = congRts.map((rt) => ({
    type: 'congruent' as const,
    rt,
    correct: true,
  }));
  return [...inc, ...cong];
}

/** 10+10+10 как в generateStimuli: конгруэнт / неконгруэнт / нейтраль. */
export function makeStroopTrials(congRt: number, incRt: number, incErrorCount: number): TrialResult[] {
  const trials: TrialResult[] = [];
  for (let i = 0; i < 10; i += 1) {
    trials.push({ type: 'congruent', rt: congRt + (i % 3), correct: true });
  }
  for (let i = 0; i < 10; i += 1) {
    const err = i < incErrorCount;
    trials.push({
      type: 'incongruent',
      rt: err ? 380 + i : incRt + (i % 4),
      correct: !err,
    });
  }
  for (let i = 0; i < 10; i += 1) {
    trials.push({ type: 'neutral', rt: 400 + (i % 3), correct: true });
  }
  return trials;
}

function baseSession(overrides: Partial<SessionResult>): SessionResult {
  return {
    id: 'synthetic',
    date: new Date().toISOString(),
    flags: 0,
    status: 'Когнитивная система работает стабильно',
    participant: SYNTH_PARTICIPANT,
    wordMemory: overrides.wordMemory!,
    flanker: overrides.flanker!,
    reaction: overrides.reaction!,
    stroop: overrides.stroop!,
    faceName: overrides.faceName!,
    ...overrides,
  };
}

/** CASE 1 — стабильный профиль: низкая вариативность RT, высокая точность. */
export function buildStableUserSession(): SessionResult {
  const wm = scoreWordMemory([...TARGET_WORDS], [...TARGET_WORDS], TARGET_WORDS);
  const flank = scoreFlanker(
    makeFlankerTrials(
      Array.from({ length: 10 }, (_, i) => 410 + i * 5),
      Array.from({ length: 10 }, (_, i) => 350 + i * 3),
    ),
  );
  const rx = scoreReaction([280, 300, 310, 295, 305], 0);
  const st = scoreStroop(makeStroopTrials(360, 470, 0));
  const fn = scoreFaceName(
    3,
    [
      { faceId: 1, selected: 'Михаил', correct: 'Михаил' },
      { faceId: 2, selected: 'Иван', correct: 'Иван' },
      { faceId: 3, selected: 'Дмитрий', correct: 'Дмитрий' },
    ],
  );
  return baseSession({ wordMemory: wm, flanker: flank, reaction: rx, stroop: st, faceName: fn });
}

/** CASE 2 — медленный, но стабильный: RT ~700 мс, низкий CV, без перегрузки переключением. */
export function buildSlowStableSession(): SessionResult {
  const wm = scoreWordMemory([...TARGET_WORDS], [...TARGET_WORDS], TARGET_WORDS);
  const flank = scoreFlanker(
    makeFlankerTrials(
      Array.from({ length: 10 }, (_, i) => 450 + (i % 2)),
      Array.from({ length: 10 }, (_, i) => 380 + (i % 2)),
    ),
  );
  const rx = scoreReaction([700, 720, 680, 710], 0);
  const st = scoreStroop(makeStroopTrials(380, 500, 0));
  const fn = scoreFaceName(
    3,
    [
      { faceId: 1, selected: 'Михаил', correct: 'Михаил' },
      { faceId: 2, selected: 'Иван', correct: 'Иван' },
      { faceId: 3, selected: 'Дмитрий', correct: 'Дмитрий' },
    ],
  );
  return baseSession({ wordMemory: wm, flanker: flank, reaction: rx, stroop: st, faceName: fn });
}

/** CASE 3 — высокая вариативность RT + средняя точность Струпа + провал отсроченного слова. */
export function buildHighVariabilitySession(): SessionResult {
  const wm = scoreWordMemory(
    [...TARGET_WORDS],
    ['яблоко', 'дом', 'река'],
    TARGET_WORDS,
  );
  const flank = scoreFlanker(
    makeFlankerTrials(
      [280, 620, 310, 780, 300, 590, 295, 800, 305, 700],
      Array.from({ length: 10 }, (_, i) => 360 + i * 2),
    ),
  );
  const rx = scoreReaction([200, 500, 300, 900, 280], 1);
  const st = scoreStroop(makeStroopTrials(380, 500, 2));
  const fn = scoreFaceName(
    2,
    [
      { faceId: 1, selected: 'Михаил', correct: 'Михаил' },
      { faceId: 2, selected: 'Дмитрий', correct: 'Иван' },
      { faceId: 3, selected: 'Дмитрий', correct: 'Дмитрий' },
    ],
  );
  return baseSession({ wordMemory: wm, flanker: flank, reaction: rx, stroop: st, faceName: fn });
}
