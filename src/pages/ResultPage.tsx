import { Button } from '../components/Button';
import { ResultCard } from '../components/ResultCard';
import { useApp } from '../context/AppContext';
import { adjustTestScores } from '../utils/adjustTestScores';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult } = useApp();
  if (!latestResult) return null;
  const metricLabels: Record<string, string> = {
    delayedRecall: 'Память (отсроченное воспроизведение)',
    faceRecognition: 'Лица-имена',
    flankerRT: 'Flanker RT (мс)',
    flankerCV: 'Flanker CV (%)',
    simpleRT: 'Простая реакция RT (мс)',
    simpleCV: 'Простая реакция CV (%)',
    stroopErrors: 'Stroop ошибки (%)',
  };

  const elevatedRisk = latestResult.flags >= 3;
  const highRisk = latestResult.flags >= 4;

  const recommendation =
    latestResult.flags <= 2
      ? 'Умеренный риск, стабильные реакции.'
      : latestResult.flags === 3
        ? 'Риск выше среднего, рекомендуется обратиться к неврологу.'
        : 'Высокий риск, рекомендуется обратиться к неврологу.';

  const adjusted = adjustTestScores(
    {
      delayedRecall: latestResult.wordMemory.delayedScore,
      faceRecognition: latestResult.faceName.score,
      flankerRT:
        latestResult.flanker.avgIncongruentRt ||
        latestResult.flanker.avgCongruentRt ||
        244,
      flankerCV: latestResult.flanker.incongruentCv,
      simpleRT: latestResult.reaction.medianRt,
      simpleCV: latestResult.reaction.cv,
      stroopErrors: latestResult.stroop.incongruentErrorRate,
    },
    {
      age: latestResult.participant.age,
      educationYears: latestResult.participant.educationYears,
      sex: latestResult.participant.sex === 'Мужской' ? 'male' : 'female',
    },
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Результаты скрининга</h1>
      <div className={`rounded-xl p-4 ${highRisk ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
        <p className="text-lg font-semibold">{latestResult.status}</p>
        <p className="text-slate-700">Флагов: {latestResult.flags} из 5</p>
        <p className="mt-2">{recommendation}</p>
        <p className="mt-2">Рекомендация: пройти расширенную диагностику.</p>
        {elevatedRisk && <p className="mt-2 text-red-700">Рекомендуется очный визит к неврологу в ближайшее время.</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ResultCard title="Память" value={`${latestResult.wordMemory.immediateScore} / ${latestResult.wordMemory.delayedScore}`} flag={latestResult.wordMemory.redFlag} />
        <ResultCard title="Flanker" value={`Точность ${latestResult.flanker.incongruentAccuracy.toFixed(1)}%, CV ${latestResult.flanker.incongruentCv.toFixed(1)}%`} flag={latestResult.flanker.redFlag} />
        <ResultCard title="Реакция" value={`Медиана ${latestResult.reaction.medianRt.toFixed(0)} мс, CV ${latestResult.reaction.cv.toFixed(1)}%`} flag={latestResult.reaction.redFlag} />
        <ResultCard title="Stroop" value={`Ошибки ${latestResult.stroop.incongruentErrorRate.toFixed(1)}%, CV ${latestResult.stroop.incongruentCv.toFixed(1)}%`} flag={latestResult.stroop.redFlag} />
        <ResultCard title="Лица-имена" value={`${latestResult.faceName.score} / 3`} flag={latestResult.faceName.redFlag} />
      </div>
      <div className="rounded-xl bg-white p-4 space-y-3 border border-emerald-200">
        <h2 className="text-xl font-bold">Скорректированные Z-оценки</h2>
        <p className="text-sm text-slate-700">Итоговый риск: {adjusted.riskLevel}</p>
        <p className="text-sm text-slate-700">Флагов по Z-критерию (&lt; -1.5): {adjusted.totalFlags}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {adjusted.metrics.map((m) => (
            <div key={m.metric} className={`rounded-lg p-2 border ${m.flagged ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="font-medium">{metricLabels[m.metric] ?? m.metric}</div>
              <div>Raw: {m.raw.toFixed(2)}</div>
              <div>Adjusted: {m.corrected.toFixed(2)}</div>
              <div>Z: {m.z.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>Купить расширенную диагностику + программу когнитивных тренировок за 399 руб</Button>
        {elevatedRisk && <Button variant="danger">Выбрать врача в вашем городе</Button>}
        <Button variant="secondary" onClick={onRestart}>Пройти снова</Button>
      </div>
    </div>
  );
};
