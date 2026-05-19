import type { DomainScore } from '../utils/cognitiveAnalytics';

type Props = { domain: DomainScore };

/** Блок домена когнитивного профиля (результат, PDF, полный отчёт). */
export const DomainProfileCard = ({ domain }: Props) => {
  const { title, score, interpretation: i } = domain;
  return (
    <div className="calm-inset border-0">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-semibold text-white">{title}</span>
        <span className="tabular-nums calm-caption">{score}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-2 rounded-full bg-emerald-800" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 space-y-2 text-sm calm-body leading-relaxed">
        <p>
          <span className="font-semibold calm-body">В жизни: </span>
          {i.inLife}
        </p>
        <p>
          <span className="font-semibold calm-body">Как проявляется: </span>
          {i.manifestations}
        </p>
        <p>
          <span className="font-semibold calm-body">О чём говорит результат: </span>
          {i.aboutResult}
        </p>
      </div>
    </div>
  );
};
