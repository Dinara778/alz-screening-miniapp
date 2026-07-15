import { describe, expect, it } from 'vitest';
import {
  attentionStabilityDomainScore,
  buildCognitiveAnalytics,
  cognitiveFlexibilityDomainScore,
  informationRetentionDomainScore,
  reactionSpeedDomainScoreFromMedian,
} from './cognitiveAnalytics';
import { reactionStabilityDomainScore } from './reactionMetrics';
import { scoreFlanker, scoreStroop } from './scoring';
import {
  buildHighVariabilitySession,
  buildStableUserSession,
  makeFlankerTrials,
} from '../debug/syntheticSessions';

function domainMap(session: ReturnType<typeof buildStableUserSession>) {
  const a = buildCognitiveAnalytics(session);
  return Object.fromEntries(a.domains.map((d) => [d.key, d.score])) as Record<string, number>;
}

describe('scoring audit — domains & index', () => {
  it('index equals rounded average of five domain scores', () => {
    for (const session of [buildStableUserSession(), buildHighVariabilitySession()]) {
      const a = buildCognitiveAnalytics(session);
      const avg = a.domains.reduce((s, d) => s + d.score, 0) / a.domains.length;
      expect(a.index.value).toBe(Math.round(avg));
      expect(a.domains).toHaveLength(5);
    }
  });

  it('stable profile: all domains high, attention/flexibility positive', () => {
    const d = domainMap(buildStableUserSession());
    expect(d.attentionStability).toBeGreaterThan(70);
    expect(d.reactionSpeed).toBeGreaterThan(70);
    expect(d.reactionStability).toBe(100);
    expect(d.cognitiveFlexibility).toBeGreaterThanOrEqual(70);
    expect(d.informationRetention).toBeGreaterThanOrEqual(85);
  });

  it('incomplete Stroop must not inflate flexibility toward 90', () => {
    const session = buildStableUserSession();
    session.stroop = scoreStroop([]);
    const a = buildCognitiveAnalytics(session);
    const flex = a.domains.find((d) => d.key === 'cognitiveFlexibility')?.score;
    expect(flex).toBe(50);
    expect(a.validation.interpretationTrusted).toBe(false);
  });

  it('empty Flanker stays neutral 50 for attention', () => {
    const session = buildStableUserSession();
    session.flanker = scoreFlanker([]);
    const a = buildCognitiveAnalytics(session);
    expect(a.domains.find((d) => d.key === 'attentionStability')?.score).toBe(50);
  });

  it('all-wrong Flanker is floored, not absolute zero', () => {
    const session = buildStableUserSession();
    session.flanker = scoreFlanker(
      makeFlankerTrials(Array(10).fill(400), Array(10).fill(350), false),
    );
    const att = buildCognitiveAnalytics(session).domains.find(
      (d) => d.key === 'attentionStability',
    )?.score;
    expect(att).toBeGreaterThanOrEqual(12);
    expect(att).toBeLessThan(40);
  });

  it('flexibility never reaches 100 (baseline tax) when Stroop data present', () => {
    expect(
      cognitiveFlexibilityDomainScore({
        stroopInterferenceMs: 20,
        stroopIncongruentErrorRate: 0,
        stroopIncongruentCv: 5,
      }),
    ).toBe(90);
    expect(
      cognitiveFlexibilityDomainScore({
        stroopInterferenceMs: 250,
        stroopIncongruentErrorRate: 40,
        stroopIncongruentCv: 50,
      }),
    ).toBe(50);
  });

  it('perfect retention reaches 100 (70 words + 30 faces)', () => {
    expect(
      informationRetentionDomainScore({
        wordDelayedScore: 5,
        faceNameScore: 3,
        wordDelta: 0,
      }),
    ).toBe(100);
  });

  it('attention messy partial never below floor; total miss not better than messy', () => {
    const messy = attentionStabilityDomainScore(
      { flankerIncongruentAccuracy: 40, flankerIncongruentCv: 55 },
      10,
      4,
    );
    const miss = attentionStabilityDomainScore(
      { flankerIncongruentAccuracy: 0, flankerIncongruentCv: 0 },
      10,
      0,
    );
    expect(messy).toBeGreaterThanOrEqual(12);
    expect(messy).toBeGreaterThanOrEqual(miss);
  });

  it('reaction floors and ceiling behave as designed', () => {
    expect(reactionSpeedDomainScoreFromMedian(220)).toBe(88);
    expect(reactionSpeedDomainScoreFromMedian(920)).toBe(12);
    expect(reactionStabilityDomainScore(10, 0)).toBe(100);
    expect(reactionStabilityDomainScore(50, 5)).toBe(50);
  });
});
