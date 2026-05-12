import { useState } from 'react';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { buildResultShareText, getShareTestLink, shareOrCopyResultText } from '../utils/shareResult';

const sellingCtaClass =
  'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, setStage, setConsultationReturnTo } = useApp();
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  if (!latestResult) return null;
  const a = buildCognitiveAnalytics(latestResult);

  const handleShare = async () => {
    setShareNotice(null);
    const link = getShareTestLink();
    const text = buildResultShareText(a.activePatternCount, a.index.value);
    try {
      const mode = await shareOrCopyResultText(text, link);
      if (mode === 'clipboard') {
        setShareNotice('Текст скопирован в буфер обмена — вставьте его в чат или соцсеть.');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setShareNotice('Не удалось открыть шаринг. Скопируйте текст вручную или откройте ссылку на тест.');
    }
  };

  const activePatterns = a.patterns.filter((p) => p.active);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
        <div className="text-xs uppercase tracking-widest text-slate-400">Аналитика по метрикам</div>
        <h1 className="text-2xl font-bold mt-1">Базовый когнитивный профиль</h1>
        <p className="text-sm text-slate-400 mt-2">
          Отчёт по одному прохождению замера. Не медицинская оценка и не диагноз.
        </p>
        {!a.validation.interpretationTrusted ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium">Ограниченная достоверность данных этого замера</p>
            {a.validation.warnings.length ? (
              <ul className="mt-2 list-disc pl-5 text-amber-900/90 space-y-1">
                {a.validation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-amber-900/90">Повторите тест при полном прохождении всех блоков.</p>
            )}
          </div>
        ) : null}
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
            Выраженных закономерностей перегрузки по правилам расчёта не зафиксировано. Профиль выглядит устойчивым в
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Поделиться</h2>
        <p className="text-sm text-slate-600">
          Отправьте короткое описание профиля друзьям или сохраните ссылку на тест.
        </p>
        <Button variant="secondary" type="button" onClick={() => void handleShare()}>
          Поделиться результатом
        </Button>
        {shareNotice ? <p className="text-sm text-emerald-800">{shareNotice}</p> : null}
      </section>

      <div className="rounded-xl bg-slate-900 text-white p-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-slate-400">Полный анализ</div>
        <p className="text-slate-200 text-sm leading-relaxed">
          Расширенный отчёт: карта перегрузки, главные факторы влияния на концентрацию и структурированный разбор по
          областям — в формате, удобном для самостоятельной работы с данными.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-lg font-bold">399 ₽</div>
          <Button
            className={sellingCtaClass}
            type="button"
            onClick={() => setStage('full-report')}
          >
            Получить полный анализ когнитивной устойчивости — 399 ₽
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Оплата пока не подключена: после нажатия открывается полный отчёт. Цена показана для проверки готовности
          платить.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-5 space-y-3">
        <h2 className="text-xl font-semibold text-emerald-950">Личный разбор когнитивного профиля</h2>
        <p className="text-slate-700 text-sm leading-relaxed">
          Если вы хотите глубже понять закономерности в своих ответах и получить персональное толкование
          результатов, можно пройти индивидуальный разбор с экспертом.
        </p>
        <p className="text-sm text-slate-600">Удалённо · 30–40 минут · персональный разбор</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="font-semibold text-slate-900">5490 ₽</span>
          <Button
            className={sellingCtaClass}
            type="button"
            onClick={() => {
              setConsultationReturnTo('result');
              setStage('consultation-request');
            }}
          >
            Записаться на разбор
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onRestart}>
          Пройти снова
        </Button>
      </div>
      <Footer />
    </div>
  );
};
