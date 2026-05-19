import { ScreenBackHeader } from '../components/ScreenBackHeader';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';

export const HistoryPage = ({ onBack }: { onBack: () => void }) => {
  const { history } = useApp();

  return (
    <div className="relative min-h-0 flex-1 space-y-4 pb-4">
      <ScreenBackHeader onBack={onBack} />
      <h1 className="app-heading">История</h1>
      {!history.length && <div className="calm-inset p-4">Пока нет завершенных сессий.</div>}
      {history.map((h) => {
        const analytics = buildCognitiveAnalytics(h);
        return (
        <div key={h.id ?? `${h.date}-${Math.random()}`} className="calm-inset p-4 space-y-2">
          <div className="font-semibold">{h.date ? new Date(h.date).toLocaleString() : 'Дата недоступна'}</div>
          <div className="text-sm calm-body">
            {(h.participant?.name ?? 'Пользователь')}, {(h.participant?.age ?? '—')} лет, {(h.participant?.sex ?? '—')}
          </div>
          <div>
            Индекс устойчивости: <span className="font-medium">{analytics.index.value}/100</span> — {analytics.index.label}
            <span className="calm-caption"> ({analytics.activePatternCount} активных закономерностей)</span>
          </div>
          <div className="text-sm calm-caption">
            Память {h.wordMemory.immediateScore}/{h.wordMemory.delayedScore}; фланкер точность {h.flanker.incongruentAccuracy.toFixed(1)}%;
            реакция вариативность {h.reaction.cv.toFixed(1)}%; струп ошибки {h.stroop.incongruentErrorRate.toFixed(1)}%; лица-имена {h.faceName.score}/3
          </div>
        </div>
        );
      })}
    </div>
  );
};
