import type { DomainScore } from '../utils/cognitiveAnalytics';

type Props = { domain: DomainScore };

/** Блок домена когнитивного профиля (результат, PDF, полный отчёт). */
export const DomainProfileCard = ({ domain }: Props) => {
  const { title, score, interpretation: i } = domain;
  return (
    <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/80">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-medium text-slate-900">{title}</span>
        <span className="tabular-nums text-slate-600">{score}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-2 rounded-full bg-emerald-800" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
        <p>
          <span className="font-semibold text-slate-800">В жизни: </span>
          {i.inLife}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Как проявляется: </span>
          {i.manifestations}
        </p>
        <p>
          <span className="font-semibold text-slate-800">О чём говорит результат: </span>
          {i.aboutResult}
        </p>
      </div>
    </div>
  );
};
