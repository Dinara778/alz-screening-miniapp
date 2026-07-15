import { describe, expect, it } from 'vitest';
import { buildCognitiveAnalytics, attentionStabilityDomainScore } from './cognitiveAnalytics';
import { scoreFlanker } from './scoring';
import type { TrialResult } from '../types';
import {
  buildHighVariabilitySession,
  buildStableUserSession,
} from '../debug/syntheticSessions';

describe('attentionStabilityDomainScore', () => {
  it('stable flanker session is well above 0', () => {
    const a = buildCognitiveAnalytics(buildStableUserSession());
    const att = a.domains.find((d) => d.key === 'attentionStability');
    expect(att?.score).toBeGreaterThan(50);
  });

  it('insufficient incongruent trials → neutral 50, not 0', () => {
    const score = attentionStabilityDomainScore({ flankerIncongruentAccuracy: 0, flankerIncongruentCv: 0 }, 0, 0);
    expect(score).toBe(50);
  });

  it('scoreFlanker empty → neutral attention via analytics', () => {
    const fl = scoreFlanker([]);
    const session = buildStableUserSession();
    session.flanker = fl;
    const a = buildCognitiveAnalytics(session);
    const att = a.domains.find((d) => d.key === 'attentionStability');
    expect(att?.score).toBe(50);
    expect(a.validation.warnings.some((w) => w.includes('фланкер'))).toBe(true);
  });

  it('high-variability flanker with all correct is not zero', () => {
    const a = buildCognitiveAnalytics(buildHighVariabilitySession());
    const att = a.domains.find((d) => d.key === 'attentionStability');
    expect(att?.score).toBeGreaterThan(0);
    expect(a.metrics.flankerIncongruentAccuracy).toBe(100);
  });

  it('skips CV>40 penalty when fewer than 3 valid incongruent RTs', () => {
    const metrics = { flankerIncongruentAccuracy: 75, flankerIncongruentCv: 80 };
    const withCvPenalty = attentionStabilityDomainScore(metrics, 10, 8);
    const withoutCvPenalty = attentionStabilityDomainScore(metrics, 10, 2);
    expect(withoutCvPenalty).toBeGreaterThan(withCvPenalty);
  });

  it('messy low accuracy + high CV never hits absolute 0 (soft floor)', () => {
    const score = attentionStabilityDomainScore(
      { flankerIncongruentAccuracy: 40, flankerIncongruentCv: 55 },
      10,
      4,
    );
    expect(score).toBeGreaterThanOrEqual(12);
  });

  it('total miss is not scored as better than messy partial hits', () => {
    const totalMiss = attentionStabilityDomainScore(
      { flankerIncongruentAccuracy: 0, flankerIncongruentCv: 0 },
      10,
      0,
    );
    const messyPartial = attentionStabilityDomainScore(
      { flankerIncongruentAccuracy: 40, flankerIncongruentCv: 55 },
      10,
      4,
    );
    expect(messyPartial).toBeGreaterThanOrEqual(totalMiss);
  });
});
