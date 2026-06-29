import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import {
  PaidReportTemporalOverload,
  PaidReportTemporalRecommendations,
} from '../components/PaidReportTemporalBlocks';
import { SupportFooter } from '../components/SupportFooter';
import { CalmScreen } from '../components/results/CalmScreen';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { useApp } from '../context/AppContext';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { useSyncPaidReportSession } from '../hooks/useSyncPaidReportSession';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import type { DomainScore } from '../utils/cognitiveAnalytics';
import { getLeadingDeficit } from '../utils/paidReport';
import {
  getOverloadMapWithTemporalTexts,
  getTemporalRecommendations,
} from '../utils/paidReportTemporal';
import { isReportPaidUnlocked, isPaymentsBackendConfigured } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type ReportPhase = 'ready' | 'report' | 'learned';

type ReportPage =
  | { id: 'index'; kind: 'index' }
  | { id: `domains-${number}`; kind: 'domains'; chunkIndex: number }
  | { id: 'overload'; kind: 'overload' }
  | { id: 'recommendations'; kind: 'recommendations' };

const learnedItems = [
  'ваши зоны перегрузки',
  'скорость восстановления',
  'слабые когнитивные паттерны',
  'рекомендации по улучшению',
] as const;

const DOMAINS_PER_SCREEN = 2;

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function nextReportButtonLabel(pageIndex: number, totalPages: number): string {
  if (pageIndex < totalPages - 1) return 'Следующая часть';
  return 'К итогам';
}

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
  useSyncPaidReportSession();
  const [phase, setPhase] = useState<ReportPhase>('ready');
  const [reportPageIndex, setReportPageIndex] = useState(0);

  const analytics = useMemo(() => {
    if (!latestResult) return null;
    return buildCognitiveAnalytics(latestResult);
  }, [latestResult]);

  const domainScoresInput = useMemo(
    () => (analytics ? analytics.domains.map((d) => ({ key: d.key, score: d.score })) : []),
    [analytics],
  );

  const domainChunks = useMemo(
    () => (analytics ? chunkItems(analytics.domains, DOMAINS_PER_SCREEN) : []),
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

  const reportPages = useMemo((): ReportPage[] => {
    const pages: ReportPage[] = [{ id: 'index', kind: 'index' }];
    domainChunks.forEach((_, chunkIndex) => {
      pages.push({ id: `domains-${chunkIndex}`, kind: 'domains', chunkIndex });
    });
    pages.push({ id: 'overload', kind: 'overload' });
    if (temporalRecommendations.length > 0) {
      pages.push({ id: 'recommendations', kind: 'recommendations' });
    }
    return pages;
  }, [domainChunks, temporalRecommendations.length]);

  const analyticsDetail = useMemo(() => {
    if (phase === 'ready') return 'ready';
    if (phase === 'learned') return 'learned';
    return `report/${reportPages[reportPageIndex]?.id ?? 'unknown'}`;
  }, [phase, reportPageIndex, reportPages]);

  useEffect(() => {
    setAnalyticsScreenDetail(analyticsDetail);
  }, [analyticsDetail, setAnalyticsScreenDetail]);

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

  const openSessionOffer = () => {
    setConsultationReturnTo('full-report');
    openResultAtStep('session-offer');
  };

  const goToNextReportPage = () => {
    if (reportPageIndex < reportPages.length - 1) {
      setReportPageIndex((i) => i + 1);
      return;
    }
    setPhase('learned');
  };

  const renderDomainSectionTitle = (chunkIndex: number) => {
    if (domainChunks.length <= 1) return 'Сильные и слабые зоны';
    return `Сильные и слабые зоны (${chunkIndex + 1} из ${domainChunks.length})`;
  };

  const renderReportPage = (page: ReportPage, domains: DomainScore[]) => {
    switch (page.kind) {
      case 'index':
        return (
          <div className="mx-auto w-full max-w-md space-y-3 pb-2">
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
          </div>
        );
      case 'domains':
        return (
          <div className="mx-auto w-full max-w-md space-y-3 pb-2">
            <div className="space-y-3">
              <SketchHighlightTitle accent={accent}>
                {renderDomainSectionTitle(page.chunkIndex)}
              </SketchHighlightTitle>
              <div className="space-y-3">
                {domains.map((d) => (
                  <DomainProfileCard key={d.key} domain={d} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'overload':
        return (
          <div className="mx-auto w-full max-w-md space-y-3 pb-2">
            <div className="space-y-3">
              <SketchHighlightTitle accent={accent}>Персональная карта перегрузки</SketchHighlightTitle>
              <PaidReportTemporalOverload hideSectionTitle cards={temporalOverloadCards} />
            </div>
          </div>
        );
      case 'recommendations':
        return (
          <div className="mx-auto w-full max-w-md space-y-3 pb-2">
            <div className="space-y-3">
              <SketchHighlightTitle accent={accent}>Что делать в этом состоянии</SketchHighlightTitle>
              <PaidReportTemporalRecommendations
                hideSectionTitle
                className="space-y-3"
                lines={temporalRecommendations}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (phase === 'ready') {
    return (
      <ReportFlowShell
        centerContent
        footer={
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className={CTA_BUTTON_CLASS}
              onClick={() => {
                setReportPageIndex(0);
                setPhase('report');
              }}
            >
              Читать отчёт
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-5 py-6 text-center sm:text-left">
          <h2 className="app-heading leading-snug">
            <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span>Ваш расширенный отчёт готов!</span>
              <span className="text-[1.35em] leading-none" aria-hidden>
                🎉
              </span>
            </span>
          </h2>
          <p className="results-body">
            Дальше — расшифровка по вашему профилю: отчёт из нескольких коротких частей, жмите кнопку внизу.
          </p>
        </div>
      </ReportFlowShell>
    );
  }

  if (phase === 'report') {
    const page = reportPages[reportPageIndex];
    if (!page) return null;

    const progressLabel = `Часть ${reportPageIndex + 1} из ${reportPages.length}`;

    return (
      <ReportFlowShell
        footer={
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium tracking-wide text-white/55">{progressLabel}</p>
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={goToNextReportPage}>
              {nextReportButtonLabel(reportPageIndex, reportPages.length)}
            </Button>
          </div>
        }
      >
        {renderReportPage(page, domainChunks[page.kind === 'domains' ? page.chunkIndex : 0] ?? [])}
      </ReportFlowShell>
    );
  }

  if (phase === 'learned') {
    return (
      <CalmScreen
        contentAlign="readable"
        footer={
          <div className="space-y-3">
            <Button type="button" variant="sell" className={CTA_BUTTON_CLASS} onClick={openSessionOffer}>
              Подробнее о сессии
            </Button>
            <SupportFooter showDeveloperCredit={false} />
          </div>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-5 pb-4">
          <SketchHighlightTitle accent={accent}>Что вы узнали:</SketchHighlightTitle>
          <ul className="calm-inset list-none space-y-2.5 results-body">
            {learnedItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="shrink-0 text-emerald-400" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3">
            <SketchHighlightTitle accent={accent}>Что дальше?</SketchHighlightTitle>
            <p className="results-body">
              А дальше вы можете пройти индивидуальную сессию со специалистом по когнитивной устойчивости для
              получения более глубоких рекомендаций по управлению своим когнитивным состоянием.
            </p>
          </div>
        </div>
      </CalmScreen>
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
