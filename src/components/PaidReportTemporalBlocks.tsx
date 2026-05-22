import type { ReactNode } from 'react';
import { NO_ACTIVE_OVERLOAD_MESSAGE } from '../utils/paidReportTemporal';
import type { TemporalOverloadCard } from '../utils/paidReportTemporal';

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/85">{children}</h3>
);

type OverloadProps = {
  cards: TemporalOverloadCard[];
  hideSectionTitle?: boolean;
  className?: string;
};

export const PaidReportTemporalOverload = ({
  cards,
  hideSectionTitle = false,
  className = 'space-y-3',
}: OverloadProps) => (
  <section className={className}>
    {hideSectionTitle ? null : <SectionTitle>Персональная карта перегрузки</SectionTitle>}
    {cards.length > 0 ? (
      <ul className="space-y-3">
        {cards.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm leading-relaxed"
          >
            <p className="font-semibold text-white">{row.title}</p>
            <p className="mt-2 calm-body text-white/88">{row.description}</p>
            <p className="mt-2 calm-body text-white/75">
              <span className="font-medium text-white/90">Как вы это замечаете сегодня: </span>
              {row.howYouNotice}
            </p>
            <p className="mt-2 calm-body text-white/75">
              <span className="font-medium text-white/90">Что сделать в этом состоянии: </span>
              {row.whatToDo}
            </p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="calm-inset calm-body text-sm text-white/70">{NO_ACTIVE_OVERLOAD_MESSAGE}</p>
    )}
  </section>
);

type RecommendationsProps = {
  lines: string[];
  hideSectionTitle?: boolean;
  className?: string;
};

export const PaidReportTemporalRecommendations = ({
  lines,
  hideSectionTitle = false,
  className = 'mt-6 space-y-3',
}: RecommendationsProps) => {
  if (!lines.length) return null;

  return (
    <section className={className}>
      {hideSectionTitle ? null : <SectionTitle>Что делать в этом состоянии</SectionTitle>}
      <ul className="calm-inset list-none space-y-2.5 results-body text-sm">
        {lines.map((line) => (
          <li key={line} className="flex gap-2 text-white/88">
            <span className="shrink-0 text-emerald-400" aria-hidden>
              •
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

type Props = {
  temporalOverloadCards: TemporalOverloadCard[];
  temporalRecommendations: string[];
};

export const PaidReportTemporalBlocks = ({
  temporalOverloadCards,
  temporalRecommendations,
}: Props) => (
  <>
    <PaidReportTemporalOverload cards={temporalOverloadCards} className="mt-6 space-y-3" />
    <PaidReportTemporalRecommendations
      lines={temporalRecommendations}
      className="mt-6 space-y-3"
    />
  </>
);
