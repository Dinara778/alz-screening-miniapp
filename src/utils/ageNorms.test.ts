import { describe, expect, it } from 'vitest';
import { buildCognitiveAnalytics } from './cognitiveAnalytics';
import { buildStableUserSession } from '../debug/syntheticSessions';
import {
  ageAdjustReactionMedianMs,
  ageAdjustStroopErrorRate,
  ageNormWordDelayed,
  applyAgeNormsToDomainMetrics,
  resolveAgeSex,
} from './ageNorms';

describe('ageNorms', () => {
  it('resolveAgeSex reads Russian sex labels', () => {
    expect(resolveAgeSex({ age: 42, sex: 'Мужской' } as never)?.sex).toBe('male');
    expect(resolveAgeSex({ age: 42, sex: 'Женский' } as never)?.sex).toBe('female');
    expect(resolveAgeSex({ age: 0, sex: 'Женский' } as never)).toBeNull();
  });

  it('makes the same raw RT look faster after age adjust for older adults', () => {
    const raw = 420;
    const young = ageAdjustReactionMedianMs(raw, 30, 'female');
    const older = ageAdjustReactionMedianMs(raw, 65, 'female');
    expect(older).toBeLessThan(young);
  });

  it('lowers effective Stroop error rate after 50', () => {
    expect(ageAdjustStroopErrorRate(30, 40)).toBe(30);
    expect(ageAdjustStroopErrorRate(30, 60)).toBe(10);
  });

  it('maps the same delayed recall higher for older adults vs young norms', () => {
    const raw = 3;
    const at35 = ageNormWordDelayed(raw, 35, 'female');
    const at70 = ageNormWordDelayed(raw, 70, 'female');
    expect(at70).toBeGreaterThan(at35);
  });

  it('applyAgeNormsToDomainMetrics is no-op without age', () => {
    const m = {
      reactionMedianRt: 400,
      reactionCv: 30,
      flankerIncongruentAccuracy: 80,
      flankerIncongruentCv: 25,
      stroopInterferenceMs: 100,
      stroopIncongruentErrorRate: 20,
      stroopIncongruentCv: 20,
      wordDelayedScore: 3,
      wordDelta: 1,
      faceNameScore: 2,
    };
    expect(applyAgeNormsToDomainMetrics(m, null)).toEqual(m);
  });

  it('same raw session: older participant gets equal or higher index than younger', () => {
    const base = buildStableUserSession();
    // замедлим реакцию, чтобы возрастная поправка была заметна
    base.reaction.successfulRTs = [520, 540, 500, 530, 510];
    base.reaction.medianRt = 520;

    const young = buildCognitiveAnalytics({
      ...base,
      participant: { ...base.participant, age: 28, sex: 'Женский' },
    });
    const older = buildCognitiveAnalytics({
      ...base,
      participant: { ...base.participant, age: 68, sex: 'Женский' },
    });

    const youngSpeed = young.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 0;
    const olderSpeed = older.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 0;
    expect(olderSpeed).toBeGreaterThan(youngSpeed);
    expect(older.index.value).toBeGreaterThanOrEqual(young.index.value);
  });
});
