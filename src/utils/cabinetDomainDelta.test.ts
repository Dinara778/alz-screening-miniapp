import { describe, expect, it } from 'vitest';
import type { CabinetAssessment } from './cabinetApi';
import { buildCabinetDomainDeltas } from './cabinetDomainDelta';

function assessment(partial: Partial<CabinetAssessment>): CabinetAssessment {
  return {
    sessionId: 's',
    score: 70,
    memoryScore: 70,
    attentionScore: 70,
    speedScore: 70,
    stabilityScore: 70,
    flexibilityScore: 70,
    compensationTip: null,
    createdAt: new Date().toISOString(),
    canOpenReport: false,
    hasReportData: false,
    ...partial,
  };
}

describe('buildCabinetDomainDeltas', () => {
  it('returns null when fewer than 2 assessments', () => {
    expect(buildCabinetDomainDeltas([])).toBeNull();
    expect(buildCabinetDomainDeltas([assessment({})])).toBeNull();
  });

  it('builds up / down / same rows like the comparison UI', () => {
    const rows = buildCabinetDomainDeltas([
      assessment({ attentionScore: 78, speedScore: 61, memoryScore: 81, sessionId: 'new' }),
      assessment({ attentionScore: 71, speedScore: 65, memoryScore: 81, sessionId: 'old' }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows?.[0]).toMatchObject({
      label: 'Внимание',
      kind: 'up',
      valueLabel: '+7%',
      badgeLabel: 'лучше',
    });
    expect(rows?.[1]).toMatchObject({
      label: 'Скорость',
      kind: 'down',
      valueLabel: '−4%',
      badgeLabel: 'ниже',
    });
    expect(rows?.[2]).toMatchObject({
      label: 'Память',
      kind: 'same',
      valueLabel: 'без изменений',
      badgeLabel: 'стабильно',
    });
  });
});
