import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { buildCognitiveProfile } from '../utils/cognitiveProfile';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult } = useApp();
  if (!latestResult) return null;
  const profile = buildCognitiveProfile(latestResult);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ваш когнитивный профиль</h1>
      <div className="rounded-xl border border-emerald-300 bg-white p-4 space-y-3">
        <div className="text-sm text-emerald-900">Индекс когнитивной устойчивости</div>
        <div className="text-5xl font-bold text-emerald-900">{profile.cognitiveStabilityIndex}</div>
        <p className="text-slate-700">{profile.overloadText}</p>
        <p className="text-sm text-slate-600">
          Индикаторы когнитивной перегрузки: {profile.overloadIndicators} из 5
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 border border-emerald-200">
          <h2 className="font-semibold mb-2">Сильные стороны</h2>
          {profile.strengths.length ? (
            <ul className="text-sm text-slate-700 space-y-1">
              {profile.strengths.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-600">Сильные стороны уточняются в динамике при повторных замерах.</div>
          )}
        </div>
        <div className="rounded-xl bg-white p-4 border border-amber-200">
          <h2 className="font-semibold mb-2">Зоны когнитивной перегрузки</h2>
          {profile.overloadZones.length ? (
            <ul className="text-sm text-slate-700 space-y-1">
              {profile.overloadZones.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-600">Выраженных зон перегрузки сейчас не обнаружено.</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {profile.domains.map((d) => (
          <div
            key={d.key}
            className={`rounded-xl p-4 border ${
              d.level === 'strong'
                ? 'bg-emerald-50 border-emerald-200'
                : d.level === 'watch'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="font-semibold">{d.title}</div>
            <div className="text-sm mt-1 text-slate-700">{d.interpretation}</div>
            <div className="text-sm mt-2 text-slate-600">{d.metrics.join(' · ')}</div>
            <div className="text-sm mt-2">
              <span className="font-medium">Персональные рекомендации:</span>
              <ul className="mt-1 space-y-1 text-slate-700">
                {d.recommendations.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-slate-950 text-white p-5 space-y-3">
        <p>
          Ваши результаты показывают не только скорость реакции, но и то, насколько стабильно мозг работает под нагрузкой.
        </p>
        <p>
          Даже при нормальной скорости мышления мозг может терять устойчивость:
          <br />— при переключении внимания,
          <br />— в условиях перегрузки,
          <br />— при длительной концентрации,
          <br />— под информационным шумом.
        </p>
        <p>Расширенный когнитивный профиль поможет увидеть:</p>
        <ul className="space-y-1 text-slate-200">
          <li>• какие именно механизмы внимания проседают первыми,</li>
          <li>• насколько стабильно мозг удерживает темп работы,</li>
          <li>• как меняется точность под нагрузкой,</li>
          <li>• есть ли признаки когнитивного переутомления,</li>
          <li>• какие паттерны снижают ясность мышления именно у вас.</li>
        </ul>
        <p className="text-slate-200">
          Это не общие советы, а персональный анализ ваших реакций, вариативности и устойчивости внимания.
        </p>
        <div className="rounded-lg bg-slate-800 p-3 text-sm">
          <div className="font-semibold mb-1">Что доступно в расширенной версии:</div>
          <div>1. Ваш когнитивный профиль: карта сильных и слабых сторон, сравнение доменов, доминирующий тип нагрузки.</div>
          <div>2. Что сильнее всего влияет на концентрацию: перегрузка переключением, нестабильность внимания, реактивность, истощение.</div>
          <div>3. Как меняется работа мозга под нагрузкой: где падает точность, растет вариативность и быстрее наступает усталость.</div>
          <div>4. Персональные рекомендации: по вашим метрикам, с причинно-следственными объяснениями и практиками.</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>Открыть расширенный когнитивный профиль за 399 ₽</Button>
        <Button variant="secondary" onClick={onRestart}>Пройти снова</Button>
      </div>
    </div>
  );
};
