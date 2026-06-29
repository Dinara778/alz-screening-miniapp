import { describe, expect, it } from 'vitest';
import { createFaceTrials } from './generateStimuli';

const CANONICAL = ['Михаил', 'Иван', 'Дмитрий'] as const;

describe('createFaceTrials', () => {
  it('uses only three session names in study and test options', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const trials = createFaceTrials(seed);
      expect(trials).toHaveLength(3);
      const sessionNames = new Set(trials.map((t) => t.correctName));
      expect(sessionNames.size).toBe(3);
      for (const name of sessionNames) {
        expect(CANONICAL).toContain(name);
      }
      for (const t of trials) {
        expect(t.options).toHaveLength(3);
        expect(t.options).toContain(t.correctName);
        for (const opt of t.options) {
          expect(sessionNames.has(opt)).toBe(true);
        }
      }
    }
  });
});
