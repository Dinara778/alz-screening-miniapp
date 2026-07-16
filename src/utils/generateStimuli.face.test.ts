import { describe, expect, it } from 'vitest';
import { createFaceTrials } from './generateStimuli';

const FACE_NAME_POOL = new Set([
  'Алексей',
  'Андрей',
  'Антон',
  'Борис',
  'Виктор',
  'Владимир',
  'Георгий',
  'Даниил',
  'Дмитрий',
  'Евгений',
  'Иван',
  'Игорь',
  'Кирилл',
  'Максим',
  'Михаил',
  'Никита',
  'Олег',
  'Павел',
  'Роман',
  'Сергей',
]);

describe('createFaceTrials', () => {
  it('uses only three session names in study and test options', () => {
    const seenNames = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const trials = createFaceTrials(seed);
      expect(trials).toHaveLength(3);
      const sessionNames = new Set(trials.map((t) => t.correctName));
      expect(sessionNames.size).toBe(3);
      for (const name of sessionNames) {
        expect(FACE_NAME_POOL.has(name)).toBe(true);
        seenNames.add(name);
      }
      for (const t of trials) {
        expect(t.options).toHaveLength(3);
        expect(t.options).toContain(t.correctName);
        for (const opt of t.options) {
          expect(sessionNames.has(opt)).toBe(true);
        }
      }
    }
    // За много сессий должен использоваться широкий пул, а не 3 фиксированных имени.
    expect(seenNames.size).toBeGreaterThan(10);
  });
});
