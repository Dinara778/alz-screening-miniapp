import { describe, expect, it } from 'vitest';
import { createFlankerTrials } from './generateStimuli';

describe('createFlankerTrials', () => {
  it('builds 20 valid trials for many seeds', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const trials = createFlankerTrials(seed);
      expect(trials).toHaveLength(20);
      expect(trials.filter((t) => t.type === 'congruent')).toHaveLength(10);
      expect(trials.filter((t) => t.type === 'incongruent')).toHaveLength(10);
      for (const t of trials) {
        expect(t.arrows).toHaveLength(5);
        expect(t.correct).toBe(t.arrows[2] as '<' | '>');
        if (t.type === 'congruent') expect(t.arrows).toBe(t.correct.repeat(5));
        if (t.type === 'incongruent') {
          const flank = t.correct === '<' ? '>' : '<';
          expect(t.arrows).toBe(`${flank}${flank}${t.correct}${flank}${flank}`);
        }
      }
      for (let i = 0; i < trials.length - 1; i += 1) {
        expect(trials[i].arrows).not.toBe(trials[i + 1].arrows);
      }
    }
  });
});
