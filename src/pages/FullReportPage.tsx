import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import {
  PaidReportTemporalOverload,
  PaidReportTemporalRecommendations,
} from '../components/PaidReportTemporalBlocks';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { useApp } from '../context/AppContext';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { formatDomainInterpretationPlain } from '../copy/cognitiveDomainInterpretations';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { getLeadingDeficit } from '../utils/paidReport';
import {
  getOverloadMapWithTemporalTexts,
  getTemporalRecommendations,
} from '../utils/paidReportTemporal';
import { downloadCognitiveReportPdf } from '../utils/pdfReport';
import { isReportPaidUnlocked, isPaymentsBackendConfigured } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
type ReportStep = 'ready' | 'report' | 'learned';

const learnedItems = [
  'ваши зоны перегрузки',
  'скорость восстановления',
  'слабые когнитивные паттерны',
  'рекомендации по улучшению',
] as const;

export const FullReportPage = () => {
  const {
    latestResult,
    participant,
    setStage,
    openResultAtStep,
    setConsultationReturnTo,
    serverPaymentsReady,
    setAnalyticsScreenDetail,
  } = useApp();
  useHydrateLatestResult();
  const [step, setStep] = useState<ReportStep>('ready');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const analytics = useMemo(() => {
    if (!latestResult) return null;
    return buildCognitiveAnalytics(latestResult);
  }, [latestResult]);

  const domainScoresInput = useMemo(
    () => (analytics ? analytics.domains.map((d) => ({ key: d.key, score: d.score })) : []),
    [analytics],
  );

  const temporalOverloadCards = useMemo(
    () => (analytics ? getOverloadMapWithTemporalTexts(analytics.overloadMap) : []),
    [analytics],
  );

  const temporalRecommendations = useMemo(() => {
    if (!analytics) return [];
    const leading = getLeadingDeficit(domainScoresInput);
    return getTemporalRecommendations(leading, domainScoresInput);
  }, [analytics, domainScoresInput]);

  useEffect(() => {
    setAnalyticsScreenDetail(step);
  }, [step, setAnalyticsScreenDetail]);

  useEffect(() => {
    if (!latestResult) return;
    if (!isPaymentsBackendConfigured(serverPaymentsReady)) return;
    if (!isReportPaidUnlocked(latestResult.id, serverPaymentsReady)) return;
    void sendAnalyticsEventToSheets({
      eventType: 'full_report_opened',
      sessionId: latestResult.id,
      stage: 'full-report',
      participant: participant ?? undefined,
    }).catch(() => {});
  }, [latestResult, participant, serverPaymentsReady]);

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

  if (!isReportPaidUnlocked(latestResult.id, serverPaymentsReady)) {
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

  const openSessionOffer = () => {
    setConsultationReturnTo('full-report');
    openResultAtStep('session-offer');
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
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => setStep('report')}>
              Далее
            </Button>
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
          showScrollHint
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
              <Button type="button" variant="secondary" className="w-full" onClick={() => setStep('learned')}>
                Далее
              </Button>
            </div>
          }
        >
          <div className="report-long-screen mx-auto w-full max-w-md space-y-6 pb-2">
            <div className="calm-inset space-y-3">
              <SketchHighlightTitle accent={accent}>
                Ваш индекс когнитивной устойчивости{' '}
                <strong className="font-bold">прямо сейчас</strong>:
              </SketchHighlightTitle>
              <div className="text-4xl font-bold tabular-nums text-white">{analytics.index.value}</div>
              <p className="results-body">{analytics.index.description}</p>
              {analytics.index.recommendations.length > 0 ? (
                <ul className="list-none space-y-2.5 results-body">
                  {analytics.index.recommendations.map((rec) => (
                    <li key={rec} className="flex gap-2">
                      <span className="shrink-0 text-emerald-400" aria-hidden>
                        •
                      </span>
                      <span>{rec}</span>
                    </li>
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

            <div className="space-y-6">
              <div className="space-y-3">
                <SketchHighlightTitle accent={accent}>Персональная карта перегрузки</SketchHighlightTitle>
                <PaidReportTemporalOverload hideSectionTitle cards={temporalOverloadCards} />
              </div>
              {temporalRecommendations.length > 0 ? (
                <div className="space-y-3">
                  <SketchHighlightTitle accent={accent}>Что делать в этом состоянии</SketchHighlightTitle>
                  <PaidReportTemporalRecommendations
                    hideSectionTitle
                    className="space-y-3"
                    lines={temporalRecommendations}
                  />
                </div>
              ) : null}
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
          <Button type="button" variant="sell" className={CTA_BUTTON_CLASS} onClick={openSessionOffer}>
            Подробнее о сессии
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
          <div className="space-y-3">
            <SketchHighlightTitle accent={accent}>Что дальше?</SketchHighlightTitle>
            <p className="results-body leading-relaxed">
              А дальше вы можете пройти индивидуальную сессию со специалистом по когнитивной устойчивости для
              получения более глубоких рекомендаций по управлению своим когнитивным состоянием.
            </p>
          </div>
        </div>
      </ReportFlowShell>
    );
  }

  return (
    <ReportFlowShell
      footer={
        <Button variant="secondary" type="button" onClick={() => openResultAtStep('hub')}>
          К результатам
        </Button>
      }
    >
      <p className="results-body text-center">Неизвестный шаг отчёта.</p>
    </ReportFlowShell>
  );
};
