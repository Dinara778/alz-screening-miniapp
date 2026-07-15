import { describe, expect, it } from 'vitest';
import { getDomainStatusChip } from './domainStatusChip';

describe('getDomainStatusChip', () => {
  it('matches screenshot-like phrases for mid/high scores', () => {
    expect(getDomainStatusChip('attention', 78)).toBe('выше нормы');
    expect(getDomainStatusChip('speed', 65)).toBe('слегка снижена');
    expect(getDomainStatusChip('memory', 81)).toBe('стабильна');
    expect(getDomainStatusChip('variability', 58)).toBe('есть колебания');
  });
});
