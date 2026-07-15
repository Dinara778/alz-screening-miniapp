import type { CabinetAssessment } from '../utils/cabinetApi';
import { buildCabinetDomainDeltas } from '../utils/cabinetDomainDelta';

type Props = {
  historySortedDesc: CabinetAssessment[];
};

export const CabinetChangeSection = ({ historySortedDesc }: Props) => {
  const rows = buildCabinetDomainDeltas(historySortedDesc);

  return (
    <section className="cabinet-card" style={{ marginTop: 16 }}>
      <h2>Что изменилось с прошлого раза:</h2>
      {!rows ? (
        <p className="cabinet-muted">
          Пройдите оценку ещё раз — здесь появится сравнение с предыдущим разом.
        </p>
      ) : (
        <ul className="cabinet-delta-list">
          {rows.map((row) => (
            <li key={row.id} className={`cabinet-delta-row cabinet-delta-row--${row.kind}`}>
              <div className="cabinet-delta-left">
                <span className="cabinet-delta-icon" aria-hidden>
                  {row.kind === 'up' ? '↗' : row.kind === 'down' ? '↘' : '✓'}
                </span>
                <span className="cabinet-delta-label">{row.label}</span>
              </div>
              <div className="cabinet-delta-right">
                <strong className="cabinet-delta-value">{row.valueLabel}</strong>
                <span className="cabinet-delta-badge">{row.badgeLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
