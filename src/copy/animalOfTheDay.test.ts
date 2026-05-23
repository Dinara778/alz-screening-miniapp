import { describe, expect, it } from 'vitest';
import {
  buildAnimalDomainInputs,
  resolveAnimalOfTheDay,
  type AnimalDomainInputs,
} from './animalOfTheDay';

describe('animalOfTheDay', () => {
  it('selects panther when domains match and index line is independent', () => {
    const inputs: AnimalDomainInputs = {
      attention: 85,
      stability: 80,
      energy: 80,
      overload: 30,
      memory: 70,
      speed: 72,
      flexibility: 68,
      dominanceGap: 15,
    };
    const card = resolveAnimalOfTheDay(inputs, 42);
    expect(card.animalId).toBe('panther');
    expect(card.indexLine).toBe('Сейчас важно не перегружать систему.');
  });

  it('keeps same animal when only index changes', () => {
    const inputs: AnimalDomainInputs = {
      attention: 85,
      stability: 80,
      energy: 80,
      overload: 30,
      memory: 70,
      speed: 72,
      flexibility: 68,
      dominanceGap: 15,
    };
    const low = resolveAnimalOfTheDay(inputs, 10);
    const high = resolveAnimalOfTheDay(inputs, 95);
    expect(low.animalId).toBe(high.animalId);
    expect(low.indexLine).not.toBe(high.indexLine);
  });

  it('builds overload from active zones', () => {
    const inputs = buildAnimalDomainInputs(
      [
        { key: 'attentionStability', score: 55 },
        { key: 'reactionStability', score: 55 },
        { key: 'reactionSpeed', score: 55 },
        { key: 'cognitiveFlexibility', score: 55 },
        { key: 'informationRetention', score: 55 },
      ],
      [
        { id: 'switch', title: '', active: true, explanation: '', lifeManifestation: '' },
        { id: 'exhaustion', title: '', active: true, explanation: '', lifeManifestation: '' },
        { id: 'reactivity', title: '', active: true, explanation: '', lifeManifestation: '' },
        { id: 'unstable_attention', title: '', active: true, explanation: '', lifeManifestation: '' },
        { id: 'load_resistance', title: '', active: true, explanation: '', lifeManifestation: '' },
      ],
    );
    expect(inputs.overload).toBeGreaterThan(70);
  });
});
