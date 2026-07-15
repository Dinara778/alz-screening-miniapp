import type { CabinetAssessment } from './cabinetApi';

export type CabinetDeltaKind = 'up' | 'down' | 'same';

export type CabinetDomainDelta = {
  id: 'attention' | 'speed' | 'memory';
  label: string;
  kind: CabinetDeltaKind;
  /** Разница в пунктах шкалы 0–100 (для подписи ±N%). */
  delta: number;
  valueLabel: string;
  badgeLabel: string;
};

const DOMAINS: Array<{
  id: CabinetDomainDelta['id'];
  label: string;
  pick: (a: CabinetAssessment) => number;
}> = [
  { id: 'attention', label: 'Внимание', pick: (a) => a.attentionScore },
  { id: 'speed', label: 'Скорость', pick: (a) => a.speedScore },
  { id: 'memory', label: 'Память', pick: (a) => a.memoryScore },
];

/** Порог «без изменений»: меньше 2 пунктов. */
const SAME_THRESHOLD = 2;

function kindFor(delta: number): CabinetDeltaKind {
  if (Math.abs(delta) < SAME_THRESHOLD) return 'same';
  return delta > 0 ? 'up' : 'down';
}

/**
 * Сравнение последней оценки с предыдущей.
 * История должна быть отсортирована от новых к старым.
 */
export function buildCabinetDomainDeltas(
  historySortedDesc: CabinetAssessment[],
): CabinetDomainDelta[] | null {
  if (historySortedDesc.length < 2) return null;
  const latest = historySortedDesc[0];
  const previous = historySortedDesc[1];
  if (!latest || !previous) return null;

  return DOMAINS.map(({ id, label, pick }) => {
    const curr = Math.round(Number(pick(latest)) || 0);
    const prev = Math.round(Number(pick(previous)) || 0);
    const delta = curr - prev;
    const kind = kindFor(delta);

    if (kind === 'same') {
      return {
        id,
        label,
        kind,
        delta: 0,
        valueLabel: 'без изменений',
        badgeLabel: 'стабильно',
      };
    }

    const abs = Math.abs(delta);
    return {
      id,
      label,
      kind,
      delta,
      valueLabel: `${delta > 0 ? '+' : '−'}${abs}%`,
      badgeLabel: kind === 'up' ? 'лучше' : 'ниже',
    };
  });
}
