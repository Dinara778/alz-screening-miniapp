import { describe, expect, it } from 'vitest';
import { normalizeInterpretationFragment } from './interpretationLabels';

describe('normalizeInterpretationFragment', () => {
  it('removes leading Сейчас and lowercases', () => {
    expect(normalizeInterpretationFragment('Сейчас любой шум отвлекает вас.')).toBe(
      'любой шум отвлекает вас.',
    );
  });

  it('lowercases without temporal prefix', () => {
    expect(normalizeInterpretationFragment('Начните со следующего: таймер.')).toBe(
      'начните со следующего: таймер.',
    );
  });

  it('leaves empty strings empty', () => {
    expect(normalizeInterpretationFragment('   ')).toBe('');
  });
});
