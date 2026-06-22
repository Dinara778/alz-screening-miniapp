import {
  INTERPRETATION_LABEL_ABOUT_RESULT,
  INTERPRETATION_LABEL_IN_LIFE,
  INTERPRETATION_LABEL_MANIFESTATION,
} from '../copy/interpretationLabels';

type Props = { domain: DomainScore };

/** Блок домена когнитивного профиля (результат, PDF, полный отчёт). */
export const DomainProfileCard = ({ domain }: Props) => {
  const { title, score, interpretation: i } = domain;
  return (
    <div className="calm-inset border-0">
      <div className="flex justify-between gap-2">
        <span className="report-domain-title">{title}</span>
        <span className="report-domain-score">{score}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-2 rounded-full bg-emerald-800" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 space-y-2 results-body">
        <p>
          <span className="font-semibold text-white/95">{INTERPRETATION_LABEL_IN_LIFE} </span>
          {i.inLife}
        </p>
        <p>
          <span className="font-semibold text-white/95">{INTERPRETATION_LABEL_MANIFESTATION} </span>
          {i.manifestations}
        </p>
        <p>
          <span className="font-semibold text-white/95">{INTERPRETATION_LABEL_ABOUT_RESULT} </span>
          {i.aboutResult}
        </p>
      </div>
    </div>
  );
};
