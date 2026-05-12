import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';

const sellingCtaClass =
  'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, setStage } = useApp();
  if (!latestResult) return null;
  const a = buildCognitiveAnalytics(latestResult);

  const activePatterns = a.patterns.filter((p) => p.active);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
        <div className="text-xs uppercase tracking-widest text-slate-400">Cognitive analytics</div>
        <h1 className="text-2xl font-bold mt-1">Базовый когнитивный профиль</h1>
        <p className="text-sm text-slate-400 mt-2">
          Data-driven отчёт по одной сессии. Не медицинская оценка и не диагноз.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="text-sm font-medium text-slate-500">Индекс когнитивной устойчивости</div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="text-5xl font-bold tabular-nums text-slate-900">{a.index.value}</span>
          <span className="text-slate-600 mb-1">/ 100</span>
        </div>
        <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full ${a.index.barColorClass}`} style={{ width: `${a.index.value}%` }} />
        </div>
        <div>
          <div className={`inline-block rounded-lg px-3 py-1 text-sm font-semibold text-white ${a.index.barColorClass}`}>
            {a.index.label}
          </div>
          <p className="mt-3 text-slate-700 leading-relaxed">{a.index.description}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Основные зоны перегрузки</h2>
        {activePatterns.length ? (
          <ul className="space-y-2">
            {activePatterns.map((p) => (
              <li key={p.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800">
                <span className="font-semibold">{p.title}</span>
                <span className="text-slate-600"> — {p.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">
            Выраженных паттернов перегрузки по правилам сессии не зафиксировано. Профиль выглядит устойчивым в
            рамках этого замера.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Профиль доменов</h2>
        <div className="space-y-4">
          {a.domains.map((d) => (
            <div key={d.key} className="border border-slate-100 rounded-lg p-3 bg-slate-50/80">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-medium text-slate-900">{d.title}</span>
                <span className="tabular-nums text-slate-600">{d.score}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-2 rounded-full bg-emerald-800" style={{ width: `${d.score}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-700">{d.shortDescription}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Краткие рекомендации</h2>
        <ul className="list-disc pl-5 text-sm text-slate-800 space-y-1">
          {a.stabilizationTips.slice(0, 5).map((t) => (
            <li key={t.text}>{t.text}</li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl bg-slate-900 text-white p-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-slate-400">Полный анализ</div>
        <p className="text-slate-200 text-sm leading-relaxed">
          Расширенный cognitive report: карта перегрузки, драйверы концентрации и структурированный разбор по
          доменам — в формате, удобном для самостоятельной работы с данными.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-lg font-bold">1490 ₽</div>
          <Button
            className={sellingCtaClass}
            type="button"
            onClick={() => setStage('full-report')}
          >
            Получить полный анализ когнитивной устойчивости — 1490 ₽
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          MVP: оплата не подключена — после нажатия открывается полный отчёт. Цена отображается для проверки
          готовности платить.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-5 space-y-3">
        <h2 className="text-xl font-semibold text-emerald-950">Личный разбор когнитивного профиля</h2>
        <p className="text-slate-700 text-sm leading-relaxed">
          Если вы хотите глубже понять свои когнитивные паттерны и получить персональную интерпретацию
          результатов, можно пройти индивидуальный cognitive review.
        </p>
        <p className="text-sm text-slate-600">Онлайн · 30–40 минут · персональный разбор</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="font-semibold text-slate-900">5490 ₽</span>
          <Button className={sellingCtaClass} type="button">
            Записаться на разбор
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onRestart}>
          Пройти снова
        </Button>
      </div>
    </div>
  );
};
