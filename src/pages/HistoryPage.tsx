import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';

export const HistoryPage = ({ onBack }: { onBack: () => void }) => {
  const { history } = useApp();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">История</h1>
      {!history.length && <div className="rounded-xl bg-white p-4">Пока нет завершенных сессий.</div>}
      {history.map((h) => {
        const analytics = buildCognitiveAnalytics(h);
        return (
        <div key={h.id ?? `${h.date}-${Math.random()}`} className="rounded-xl bg-white p-4 space-y-2">
          <div className="font-semibold">{h.date ? new Date(h.date).toLocaleString() : 'Дата недоступна'}</div>
          <div className="text-sm text-slate-700">
            {(h.participant?.name ?? 'Пользователь')}, {(h.participant?.age ?? '—')} лет, {(h.participant?.sex ?? '—')}, ПК: {(h.participant?.pcConfidence ?? '—')}/5, образование: {(h.participant?.educationYears ?? '—')} лет
          </div>
          <div>
            Индекс устойчивости: <span className="font-medium">{analytics.index.value}/100</span> — {analytics.index.label}
            <span className="text-slate-600"> ({analytics.activePatternCount} активных паттернов)</span>
          </div>
          <div className="text-sm text-slate-600">
            Память {h.wordMemory.immediateScore}/{h.wordMemory.delayedScore}; Flanker точность {h.flanker.incongruentAccuracy.toFixed(1)}%;
            Реакция CV {h.reaction.cv.toFixed(1)}%; Stroop ошибки {h.stroop.incongruentErrorRate.toFixed(1)}%; Лица-имена {h.faceName.score}/3
          </div>
        </div>
        );
      })}
      <Button variant="secondary" onClick={onBack}>
        Назад
      </Button>
    </div>
  );
};
