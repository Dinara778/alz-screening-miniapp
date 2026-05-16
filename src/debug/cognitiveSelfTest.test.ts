import { describe, expect, it } from 'vitest';
import { buildCognitiveAnalytics, reactionSpeedDomainScoreFromMedian } from '../utils/cognitiveAnalytics';
import { reactionStabilityDomainScore } from '../utils/reactionMetrics';
import { getGranularIndexInterpretation } from '../utils/indexInterpretationBands';
import { scoreReaction } from '../utils/scoring';
import { formatCognitiveSelfValidationText, runCognitiveSelfValidation } from './cognitiveSelfTest';
import {
  buildHighVariabilitySession,
  buildSlowStableSession,
  buildStableUserSession,
} from './syntheticSessions';

describe('reactionStabilityDomainScore', () => {
  it('does not return 0 for high but valid variability', () => {
    expect(reactionStabilityDomainScore(58, 1)).toBeGreaterThanOrEqual(12);
    expect(reactionStabilityDomainScore(58, 1)).toBeLessThan(50);
  });

  it('floors at 12 for extreme CV and many anticipations', () => {
    expect(reactionStabilityDomainScore(95, 15)).toBe(12);
  });
});

describe('reactionSpeedDomainScoreFromMedian', () => {
  it('never returns 0 for typical slow valid medians', () => {
    expect(reactionSpeedDomainScoreFromMedian(700)).toBeGreaterThanOrEqual(12);
    expect(reactionSpeedDomainScoreFromMedian(700)).toBeLessThan(70);
    expect(reactionSpeedDomainScoreFromMedian(300)).toBeGreaterThanOrEqual(70);
  });

  it('returns neutral 50 for invalid input', () => {
    expect(reactionSpeedDomainScoreFromMedian(0)).toBe(50);
    expect(reactionSpeedDomainScoreFromMedian(NaN)).toBe(50);
  });
});

describe('scoreReaction sanitization', () => {
  it('ignores zeros and sub-threshold RTs for median and CV', () => {
    const r = scoreReaction([0, 0, 280, 300, 310], 0);
    expect(r.medianRt).toBe(300);
    expect(r.successfulRTs).toEqual([0, 0, 280, 300, 310]);
  });
});

describe('granular cognitive index interpretation', () => {
  it('uses distinct labels and copy for 67 vs 52', () => {
    const i67 = getGranularIndexInterpretation(67);
    const i52 = getGranularIndexInterpretation(52);
    expect(i67.granularId).toBe('60_69');
    expect(i52.granularId).toBe('50_59');
    expect(i67.label).toContain('Умеренная');
    expect(i52.label).toContain('Заметная');
    expect(i67.description).toContain('высокой нагрузке');
    expect(i52.description).toContain('истощается');
    expect(i67.recommendations[0]).not.toBe(i52.recommendations[0]);
    expect(i67.overloadVisualTier).not.toBe(i52.overloadVisualTier);
  });
});

describe('cognitive self-validation cases', () => {
  it('runs three synthetic profiles without throwing', () => {
    const report = runCognitiveSelfValidation();
    expect(report).toHaveLength(3);
    const text = formatCognitiveSelfValidationText();
    expect(text).toContain('CASE1_STABLE');
    expect(text).toContain('CASE3_HIGH_VAR');
  });

  it('CASE1: high stability index, reaction speed not zero, trusted', () => {
    const a = buildCognitiveAnalytics(buildStableUserSession());
    expect(a.validation.interpretationTrusted).toBe(true);
    expect(a.validation.warnings.length).toBe(0);
    expect(a.metrics.reactionMedianRt).toBeGreaterThan(0);
    const speed = a.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 0;
    expect(speed).toBeGreaterThan(0);
    expect(a.index.value).toBeGreaterThanOrEqual(60);
    expect(a.patterns.find((p) => p.id === 'attention_instability')?.active).toBe(false);
  });

  it('CASE2: slow median, speed score not zero, no switching overload', () => {
    const a = buildCognitiveAnalytics(buildSlowStableSession());
    expect(a.validation.interpretationTrusted).toBe(true);
    expect(a.metrics.reactionMedianRt).toBeGreaterThan(650);
    const speed = a.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 0;
    expect(speed).toBeGreaterThanOrEqual(12);
    expect(speed).toBeLessThan(70);
    expect(a.patterns.find((p) => p.id === 'switching_overload')?.active).toBe(false);
  });

  it('CASE3: differs from CASE1 and flags attention instability', () => {
    const a1 = buildCognitiveAnalytics(buildStableUserSession());
    const a3 = buildCognitiveAnalytics(buildHighVariabilitySession());
    expect(Math.abs(a1.index.value - a3.index.value)).toBeGreaterThanOrEqual(5);
    expect(a3.patterns.find((p) => p.id === 'attention_instability')?.active).toBe(true);
    expect(a3.metrics.reactionCv).toBeGreaterThan(35);
    const stab = a3.domains.find((d) => d.key === 'reactionStability')?.score ?? 0;
    expect(stab).toBeGreaterThanOrEqual(12);
    expect(stab).toBeLessThan(55);
  });

  it('empty valid reaction RT: warnings and degraded interpretation', () => {
    const base = buildStableUserSession();
    const broken = {
      ...base,
      reaction: scoreReaction([], 0),
    };
    const a = buildCognitiveAnalytics(broken);
    expect(a.validation.warnings.some((w) => w.includes('реакции'))).toBe(true);
    expect(a.validation.interpretationTrusted).toBe(false);
    expect(a.index.label).toContain('Ограниченная достоверность');
  });
});
