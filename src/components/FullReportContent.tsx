import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { DomainProfileCard } from './DomainProfileCard';
import {
  PaidReportTemporalOverload,
  PaidReportTemporalRecommendations,
} from './PaidReportTemporalBlocks';
import { ReportFinishFooter, ReportTomorrowBanner, type ReportFinishMode } from './ReportFinishBlock';
import { SupportFooter } from './SupportFooter';
import { CalmScreen } from './results/CalmScreen';
import { ReportFlowShell } from './results/ReportFlowShell';
import { SketchHighlightTitle } from './results/SketchHighlightTitle';
import { scoreAccentFromValue } from './results/scoreAccent';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { DIGITAL_DETOX_SCREENS, shouldShowDigitalDetox } from '../copy/digitalDetoxContent';
import { buildCognitiveAnalytics, pickRandomPatternRecommendation } from '../utils/cognitiveAnalytics';
import type { DomainScore } from '../utils/cognitiveAnalytics';
import { getLeadingDeficit } from '../utils/paidReport';
import {
  getOverloadMapWithTemporalTexts,
  getTemporalRecommendations,
} from '../utils/paidReportTemporal';
import type { SessionResult } from '../types';

type ReportPhase = 'ready' | 'report' | 'learned' | 'detox';

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

export type FullReportContentProps = {
  session: SessionResult;
  onDone: () => void;
  doneButtonLabel?: string;
  onAnalyticsDetail?: (detail: string) => void;
  /** Финал отчёта для подписчиков: плашка «завтра утром», одна кнопка в кабинет + на главную */
  finishMode?: ReportFinishMode;
};

export const FullReportContent = ({
  session,
  onDone,
  doneButtonLabel = 'К результатам',
  onAnalyticsDetail,
  finishMode,
}: FullReportContentProps) => {
  const [phase, setPhase] = useState<ReportPhase>('ready');
  const [reportPageIndex, setReportPageIndex] = useState(0);
  const [detoxPageIndex, setDetoxPageIndex] = useState(0);

  const analytics = useMemo(() => buildCognitiveAnalytics(session), [session]);

  const domainScoresInput = useMemo(
    () => analytics.domains.map((d) => ({ key: d.key, score: d.score })),
    [analytics],
  );

  const domainChunks = useMemo(() => chunkItems(analytics.domains, DOMAINS_PER_SCREEN), [analytics]);

  const temporalOverloadCards = useMemo(
    () => getOverloadMapWithTemporalTexts(analytics.overloadMap),
    [analytics],
  );

  const temporalRecommendations = useMemo(() => {
    const leading = getLeadingDeficit(domainScoresInput);
    return getTemporalRecommendations(leading, domainScoresInput);
  }, [analytics, domainScoresInput]);

  const patternTip = useMemo(
    () => pickRandomPatternRecommendation(analytics.patterns, session.id),
    [analytics, session.id],
  );

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

  const showDetox = shouldShowDigitalDetox(analytics.index.value);

  const analyticsDetail = useMemo(() => {
    if (phase === 'ready') return 'ready';
    if (phase === 'learned') return 'learned';
    if (phase === 'detox') return `detox/${DIGITAL_DETOX_SCREENS[detoxPageIndex]?.id ?? 'unknown'}`;
    return `report/${reportPages[reportPageIndex]?.id ?? 'unknown'}`;
  }, [phase, reportPageIndex, reportPages, detoxPageIndex]);

  useEffect(() => {
    onAnalyticsDetail?.(analyticsDetail);
  }, [analyticsDetail, onAnalyticsDetail]);

  const accent = scoreAccentFromValue(analytics.index.value);
  const accountEmail = session.participant?.email ?? null;

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
            <div className="calm-inset results-prose">
              <SketchHighlightTitle accent={accent}>
                Ваш индекс когнитивной устойчивости{' '}
                <strong className="font-bold">прямо сейчас</strong>:
              </SketchHighlightTitle>
              <div className="text-4xl font-bold tabular-nums text-white">{analytics.index.value}</div>
              <p className="results-body">{analytics.index.description}</p>
              {analytics.index.recommendations.length > 0 || patternTip ? (
                <ul className="list-none space-y-2.5 results-body">
                  {analytics.index.recommendations.map((rec) => (
                    <li key={rec} className="flex gap-2">
                      <span className="shrink-0 text-emerald-400" aria-hidden>
                        •
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                  {patternTip ? (
                    <li className="flex gap-2">
                      <span className="shrink-0 text-emerald-400" aria-hidden>
                        •
                      </span>
                      <span>{patternTip}</span>
                    </li>
                  ) : null}
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
              <div className="space-y-4">
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
        accountEmail={accountEmail}
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
        accountEmail={accountEmail}
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
    const finishAfterLearned = finishMode && !showDetox;
    return (
      <CalmScreen
        contentAlign="readable"
        footer={
          finishAfterLearned ? (
            <ReportFinishFooter mode={finishMode} />
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                className={CTA_BUTTON_CLASS}
                onClick={() => {
                  if (showDetox) {
                    setDetoxPageIndex(0);
                    setPhase('detox');
                    return;
                  }
                  onDone();
                }}
              >
                {showDetox ? 'Цифровой детокс' : doneButtonLabel}
              </Button>
              <SupportFooter
                showDeveloperCredit={false}
                showCabinetAccess={!finishMode}
                accountEmail={accountEmail}
              />
            </div>
          )
        }
      >
        <div className="mx-auto w-full max-w-md space-y-5 pb-4">
          {finishAfterLearned ? (
            <ReportTomorrowBanner />
          ) : (
            <>
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
            </>
          )}
        </div>
      </CalmScreen>
    );
  }

  if (phase === 'detox') {
    const screen = DIGITAL_DETOX_SCREENS[detoxPageIndex];
    if (!screen) return null;

    const isLast = detoxPageIndex >= DIGITAL_DETOX_SCREENS.length - 1;

    return (
      <ReportFlowShell
        accountEmail={accountEmail}
        footer={
          isLast && finishMode ? (
            <ReportFinishFooter mode={finishMode} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs font-medium tracking-wide text-white/55">
                Часть {detoxPageIndex + 1} из {DIGITAL_DETOX_SCREENS.length}
              </p>
              <Button
                type="button"
                className={CTA_BUTTON_CLASS}
                onClick={() => {
                  if (isLast) {
                    onDone();
                    return;
                  }
                  setDetoxPageIndex((i) => i + 1);
                }}
              >
                {isLast ? doneButtonLabel : 'Следующая часть'}
              </Button>
            </div>
          )
        }
      >
        <div className="mx-auto w-full max-w-md space-y-4 pb-2">
          {isLast && finishMode ? <ReportTomorrowBanner /> : null}
          <SketchHighlightTitle accent={accent}>{screen.title}</SketchHighlightTitle>
          <div className="calm-inset whitespace-pre-line results-body">{screen.body}</div>
        </div>
      </ReportFlowShell>
    );
  }

  return (
    <ReportFlowShell
      accountEmail={accountEmail}
      footer={
        <Button variant="secondary" type="button" onClick={onDone}>
          {doneButtonLabel}
        </Button>
      }
    >
      <p className="results-body text-center">Неизвестный шаг отчёта.</p>
    </ReportFlowShell>
  );
};
