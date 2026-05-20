import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import { ResultOverloadMap } from '../components/ResultOverloadMap';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { RetakeTestButton } from '../components/RetakeTestButton';
import { useApp } from '../context/AppContext';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { formatDomainInterpretationPlain } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { downloadCognitiveReportPdf } from '../utils/pdfReport';
import { isReportPaidUnlocked, isPaymentsBackendConfigured } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import type { ReportFlowStep } from '../types';
import { loadSavedReportStep, patchProgressReportStep } from '../utils/storage';

type ReportStep = ReportFlowStep;

const learnedItems = [
  'ваши зоны перегрузки',
  'скорость восстановления',
  'слабые когнитивные паттерны',
  'рекомендации по улучшению',
] as const;

const upsellFeatures = [
  'Онлайн-расшифровку результатов простым языком с опытным экспертом по когнитивной устойчивости (созвон)',
  'Персональные рекомендации под вашу ситуацию',
  'Понимание, что больше всего мешает вашему ресурсу',
  'План улучшения показателей',
] as const;

const REPORT_UI_KEY = 'alz_report_ui_v1';

function loadInitialReportStep(): ReportStep {
  const fromProgress = loadSavedReportStep();
  if (fromProgress) return fromProgress;
  try {
    const raw = sessionStorage.getItem(REPORT_UI_KEY);
    if (!raw) return 'ready';
    const p = JSON.parse(raw) as { step?: ReportStep };
    if (p.step === 'report' || p.step === 'learned' || p.step === 'upsell') return p.step;
  } catch {
    /* ignore */
  }
  return 'ready';
}

export const FullReportPage = () => {
  const { latestResult, participant, setStage, setConsultationReturnTo, retakeTest } = useApp();
  useHydrateLatestResult();
  const [step, setStep] = useState<ReportStep>(loadInitialReportStep);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const goReportStep = useCallback((next: ReportStep) => {
    setStep(next);
    patchProgressReportStep(next);
    try {
      sessionStorage.setItem(REPORT_UI_KEY, JSON.stringify({ step: next }));
    } catch {
      /* ignore */
    }
  }, []);

  const analytics = useMemo(() => {
    if (!latestResult) return null;
    return buildCognitiveAnalytics(latestResult);
  }, [latestResult]);

  useEffect(() => {
    patchProgressReportStep(step);
    try {
      sessionStorage.setItem(REPORT_UI_KEY, JSON.stringify({ step }));
    } catch {
      /* ignore */
    }
  }, [step]);

  useEffect(() => {
    if (!latestResult) return;
    if (!isPaymentsBackendConfigured()) return;
    if (!isReportPaidUnlocked(latestResult.id)) return;
    void sendAnalyticsEventToSheets({
      eventType: 'full_report_opened',
      sessionId: latestResult.id,
      stage: 'full-report',
      participant: participant ?? undefined,
    }).catch(() => {});
  }, [latestResult, participant]);

  if (!latestResult || !analytics) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-white">
        <p className="text-sm text-white/85">Загружаем отчёт…</p>
        <Button variant="secondary" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  if (!isReportPaidUnlocked(latestResult.id)) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-white">
        <p className="font-medium">Расширенный отчёт доступен после оплаты.</p>
        <Button variant="secondary" type="button" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  const accent = scoreAccentFromValue(analytics.index.value);

  const handlePdfDownload = async () => {
    if (!pdfRef.current) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadCognitiveReportPdf(pdfRef.current, `otchet-corta-${latestResult.id.slice(0, 8)}.pdf`);
      void sendAnalyticsEventToSheets({
        eventType: 'report_pdf_downloaded',
        sessionId: latestResult.id,
        stage: 'full-report',
        participant: participant ?? undefined,
      }).catch(() => {});
    } catch (e) {
      console.error('[pdf]', e);
      setPdfError(
        'Не удалось сформировать PDF. Откройте мини-приложение через ⋯ → «Открыть в браузере» и повторите.',
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handleConsultation = () => {
    setConsultationReturnTo('full-report');
    setStage('consultation-request');
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU');

  const pdfMarkup = (
    <div
      ref={pdfRef}
      className="bg-white p-8 text-[13px] leading-relaxed text-slate-900"
      style={{ width: '190mm', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <h1 className="text-xl font-bold">Расширенный отчёт Corta</h1>
      <p className="mt-2 text-sm text-slate-600">
        {fmt(latestResult.date)} · Индекс {analytics.index.value}/100 · {analytics.index.label}
      </p>
      <p className="mt-3">{analytics.index.description}</p>
      <h2 className="mt-6 text-lg font-bold">Домены</h2>
      <ul className="mt-2 space-y-3">
        {analytics.domains.map((d) => (
          <li key={d.key}>
            <strong>
              {d.title} — {d.score}/100
            </strong>
            <div className="mt-1 whitespace-pre-line text-sm">{formatDomainInterpretationPlain(d.interpretation)}</div>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-bold">Карта перегрузки</h2>
      <ul className="mt-2 space-y-1">
        {analytics.overloadMap.map((o) => (
          <li key={o.id}>
            {o.title}: {o.active ? o.explanation : 'в пределах нормы'}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-bold">Рекомендации</h2>
      <ul className="mt-2 list-disc pl-5">
        {analytics.stabilizationTips.map((t) => (
          <li key={t.text}>{t.text}</li>
        ))}
      </ul>
    </div>
  );

  const hiddenPdfLayer = (
    <div className="pdf-export-root pointer-events-none fixed left-[-12000px] top-0 z-0 w-[210mm] max-w-[210mm]">
      {pdfMarkup}
    </div>
  );

  if (step === 'ready') {
    return (
      <ReportFlowShell
        footer={
          <div className="flex flex-col gap-3">
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => goReportStep('report')}>
              Далее
            </Button>
            <RetakeTestButton onClick={retakeTest} />
          </div>
        }
      >
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 py-6 text-center sm:text-left">
          <h2 className="app-heading leading-snug">
            <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span>Ваш расширенный отчёт готов!</span>
              <span className="text-[1.35em] leading-none" aria-hidden>
                🎉
              </span>
            </span>
          </h2>
          <p className="results-body">
            Дальше — расширенная расшифровка именно по вашему когнитивному профилю.
          </p>
        </div>
      </ReportFlowShell>
    );
  }

  if (step === 'report') {
    return (
      <>
        <ReportFlowShell
          footer={
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                className={CTA_BUTTON_CLASS}
                disabled={pdfBusy}
                onClick={() => void handlePdfDownload()}
              >
                {pdfBusy ? 'Формируем PDF…' : 'Скачать PDF'}
              </Button>
              {pdfError ? <p className="text-center text-sm text-amber-200/90">{pdfError}</p> : null}
              <Button type="button" variant="secondary" className="w-full" onClick={() => goReportStep('learned')}>
                Далее
              </Button>
              <RetakeTestButton onClick={retakeTest} />
            </div>
          }
        >
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="calm-inset space-y-3">
              <SketchHighlightTitle accent={accent}>Индекс когнитивной устойчивости</SketchHighlightTitle>
              <div className="text-4xl font-bold tabular-nums">{analytics.index.value}</div>
              <p className="results-body">{analytics.index.description}</p>
              {analytics.index.recommendations.length > 0 ? (
                <ul className="list-none space-y-2 text-sm leading-relaxed text-white/88 sm:text-base">
                  {analytics.index.recommendations.map((rec) => (
                    <li key={rec}>• {rec}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-3">
              <SketchHighlightTitle accent={accent}>Сильные и слабые зоны</SketchHighlightTitle>
              <div className="space-y-3">
                {analytics.domains.map((d) => (
                  <DomainProfileCard key={d.key} domain={d} />
                ))}
              </div>
            </div>

            <div>
              <SketchHighlightTitle accent={accent}>Карта когнитивной перегрузки</SketchHighlightTitle>
              <div className="mt-3">
                <ResultOverloadMap
                  overloadMap={analytics.overloadMap}
                  overloadMapIntro={analytics.index.overloadMapIntro}
                  overloadVisualTier={analytics.index.overloadVisualTier}
                />
              </div>
            </div>

            <div className="calm-inset space-y-3">
              <SketchHighlightTitle accent={accent}>Краткие рекомендации</SketchHighlightTitle>
              <ul className="list-none space-y-2 text-sm leading-relaxed text-white/88 sm:text-base">
                {analytics.stabilizationTips.map((t) => (
                  <li key={t.text}>• {t.text}</li>
                ))}
              </ul>
            </div>
          </div>
        </ReportFlowShell>
        {hiddenPdfLayer}
      </>
    );
  }

  if (step === 'learned') {
    return (
      <ReportFlowShell
        footer={
          <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => goReportStep('upsell')}>
            Далее
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-5">
          <SketchHighlightTitle accent={accent}>Что вы узнали:</SketchHighlightTitle>
          <ul className="calm-inset space-y-2.5 text-base leading-relaxed text-white/88 sm:text-lg">
            {learnedItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-400" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </ReportFlowShell>
    );
  }

  return (
    <ReportFlowShell
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm leading-relaxed text-white/55">
            После оформления заказа мы с вами свяжемся в течение 15 минут.
          </p>
          <Button type="button" variant="sell" className={CTA_BUTTON_CLASS} onClick={handleConsultation}>
            Записаться на сессию — 5 490 ₽
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md space-y-5">
        <SketchHighlightTitle accent={accent} tuckBottomOutline className="mb-3">
          Разобрать результаты с экспертом
        </SketchHighlightTitle>
        <p className="results-body">
          30-минутная сессия по вашему когнитивному профилю с экспертом по когнитивной устойчивости.
        </p>
        <div className="calm-inset space-y-3">
          <p className="text-sm font-semibold text-white/90 sm:text-base">Что вы получите:</p>
          <ul className="space-y-2.5 text-sm leading-relaxed text-white/88 sm:text-base">
            {upsellFeatures.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="shrink-0 text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ReportFlowShell>
  );
};
