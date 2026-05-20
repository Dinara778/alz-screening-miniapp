import { useEffect, useState } from 'react';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { Button } from '../components/Button';
import { CalmScreen } from '../components/results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { ScoreRing } from '../components/results/ScoreRing';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { SupportFooter } from '../components/SupportFooter';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { useApp } from '../context/AppContext';
import type { DomainInterpretationCopy } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics, type DomainScore } from '../utils/cognitiveAnalytics';
import type { IndexInterpretation } from '../utils/indexInterpretationBands';
import { shareResultWithCard } from '../utils/shareResult';
import { isPaymentsEnabled, shouldBypassReportPayment } from '../utils/paymentStub';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { hasPaymentReturnInUrl } from '../utils/storage';
import {
  isReportPaidUnlocked,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
  reportPaidStorageKey,
  recoverProdamusPaymentFromUrl,
} from '../utils/telegramPayments';

type ResultStep = 'index' | 'index-detail' | 'domain-metric' | 'domain-detail' | 'hub';

const calmBtnClass = CTA_BUTTON_CLASS;
const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

const DomainInterpretationBody = ({
  title,
  interpretation,
  accent,
}: {
  title: string;
  interpretation: DomainInterpretationCopy;
  accent: string;
}) => {
  const { inLife, manifestations, aboutResult } = interpretation;
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <SketchHighlightTitle accent={accent}>{title}</SketchHighlightTitle>
      <div className="calm-inset space-y-4 results-body text-left">
        <p>
          <span className="font-semibold text-white/95">В жизни: </span>
          {inLife}
        </p>
        <p>
          <span className="font-semibold text-white/95">Как проявляется: </span>
          {manifestations}
        </p>
        <p>
          <span className="font-semibold text-white/95">О чём говорит результат: </span>
          {aboutResult}
        </p>
      </div>
    </div>
  );
};

/** «Прямо сейчас у вас …» — из подписи индекса (без дублирования заглавной). */
const indexStatusPhrase = (label: string) => {
  const rest = label.trim();
  if (!rest) return 'Прямо сейчас у вас заметная перегрузка внимания';
  return `Прямо сейчас у вас ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
};

const IndexInterpretationBody = ({ index, accent }: { index: IndexInterpretation; accent: string }) => (
  <div className="mx-auto w-full max-w-md space-y-4">
    <SketchHighlightTitle accent={accent}>{index.label}</SketchHighlightTitle>
    <div className="calm-inset space-y-5 results-body text-left">
      <p>{index.description}</p>
      {index.recommendations.length > 0 ? (
        <div>
          <p className="mb-3 font-semibold text-white/95">Рекомендации:</p>
          <ul className="list-none space-y-2.5">
            {index.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  </div>
);

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, setStage } = useApp();
  useHydrateLatestResult();
  const [step, setStep] = useState<ResultStep>('index');
  const [domainIndex, setDomainIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  if (!latestResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center text-white/80">
        <p className="text-sm">Загружаем результаты…</p>
        <button type="button" className={calmBtnGhost} onClick={onRestart}>
          Начать сначала
        </button>
      </div>
    );
  }
  const a = buildCognitiveAnalytics(latestResult);
  const domains = a.domains;
  const currentDomain: DomainScore | undefined = domains[domainIndex];
  const accent = scoreAccentFromValue(a.index.value);
  const skipNativePayment = shouldBypassReportPayment();

  const handleShare = async () => {
    setShareNotice(null);
    setShareBusy(true);
    try {
      const mode = await shareResultWithCard({ indexValue: a.index.value, accent });
      if (mode === 'download_and_telegram') {
        setShareNotice('Картинка сохранена — прикрепите её в чат; ссылка на бота откроется отдельно');
      } else if (mode === 'clipboard') {
        setShareNotice('Картинка сохранена, ссылка на бота скопирована');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setShareNotice('Не удалось поделиться');
    } finally {
      setShareBusy(false);
    }
  };

  const unlockFullReport = () => {
    if (!latestResult) return;
    localStorage.setItem(reportPaidStorageKey(latestResult.id), '1');
    setStage('full-report');
  };

  useEffect(() => {
    if (!latestResult?.id || skipNativePayment || !hasPaymentReturnInUrl()) return;
    void recoverProdamusPaymentFromUrl().then((recovery) => {
      if (recovery?.product === 'full_report' && recovery.sessionId === latestResult.id) {
        localStorage.setItem(reportPaidStorageKey(latestResult.id), '1');
        setStage('full-report');
      }
    });
  }, [latestResult?.id, skipNativePayment, setStage]);

  const reportUnlocked = latestResult ? isReportPaidUnlocked(latestResult.id) : false;

  const openCheckout = () => {
    if (!latestResult) return;
    if (skipNativePayment || reportUnlocked) {
      unlockFullReport();
      return;
    }
    if (!isPaymentsEnabled()) return;
    setPayNotice(null);
    setCheckoutOpen(true);
  };


  const startDomains = () => {
    setDomainIndex(0);
    setStep('domain-metric');
  };

  const nextFromDomainDetail = () => {
    if (domainIndex < domains.length - 1) {
      setDomainIndex((i) => i + 1);
      setStep('domain-metric');
    } else {
      setStep('hub');
    }
  };

  if (step === 'index') {
    return (
      <CalmScreen
        kicker="Ваш когнитивный профиль"
        kickerProfile
        footer={
          <>
            {!a.validation.interpretationTrusted ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/90">
                Ограниченная достоверность замера — пройдите все блоки заново для точного профиля.
              </p>
            ) : null}
            <Button type="button" className={calmBtnClass} onClick={() => setStep('index-detail')}>
              Узнать, что это значит
            </Button>
          </>
        }
      >
        <OrganicMetricHalo accent={accent} emphasis>
          <span className="inline-flex items-baseline justify-center gap-0.5 tabular-nums leading-none">
            <span className="text-[clamp(3.25rem,16vw,4.75rem)] font-bold tracking-tight text-white">
              {a.index.value}
            </span>
            <span className="text-[clamp(0.75rem,3.2vw,1rem)] font-medium text-white/45">/100</span>
          </span>
        </OrganicMetricHalo>
        <p className="mt-8 max-w-[min(22rem,92vw)] px-2 text-center text-lg font-semibold leading-snug text-white sm:mt-10 sm:text-xl">
          {indexStatusPhrase(a.index.label)}
        </p>
      </CalmScreen>
    );
  }

  if (step === 'index-detail') {
    return (
      <CalmScreen
        kicker="Индекс когнитивной устойчивости"
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={startDomains}>
            Далее — показатели профиля
          </Button>
        }
      >
        <IndexInterpretationBody index={a.index} accent={accent} />
      </CalmScreen>
    );
  }

  if (step === 'domain-metric' && currentDomain) {
    const d = currentDomain;
    const dAccent = scoreAccentFromValue(d.score);
    return (
      <CalmScreen
        kicker={`${domainIndex + 1} / ${domains.length}`}
        footer={
          <Button type="button" className={calmBtnClass} onClick={() => setStep('domain-detail')}>
            Узнать, что это значит
          </Button>
        }
      >
        <p className="metric-screen-title mb-8 max-w-[18rem]">{d.title}</p>
        <div className="relative flex h-[min(62vw,260px)] w-[min(62vw,260px)] items-center justify-center">
          <ScoreRing value={d.score} accent={dAccent} size={260} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[clamp(3rem,14vw,4.25rem)] font-semibold tabular-nums leading-none text-white">
              {d.score}
            </span>
          </div>
        </div>
      </CalmScreen>
    );
  }

  if (step === 'domain-detail' && currentDomain) {
    const d = currentDomain;
    return (
      <CalmScreen
        kicker={`${domainIndex + 1} / ${domains.length}`}
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={nextFromDomainDetail}>
            {domainIndex < domains.length - 1 ? 'Далее' : 'Готово'}
          </Button>
        }
      >
        <DomainInterpretationBody
          title={d.title}
          interpretation={d.interpretation}
          accent={scoreAccentFromValue(d.score)}
        />
      </CalmScreen>
    );
  }

  const reportFeatures = [
    'Подробная карта когнитивной перегрузки',
    'Расшифровка сильных и слабых зон',
    'Адресные рекомендации именно под ваш профиль',
    'PDF-отчёт для скачивания',
  ] as const;

  return (
    <>
    <CalmScreen
      contentAlign="readable"
      footer={
        <div className="space-y-3">
          {shareNotice ? (
            <p className="text-center text-xs leading-relaxed text-white/70">{shareNotice}</p>
          ) : null}
          <button
            type="button"
            className={calmBtnGhost}
            disabled={shareBusy}
            onClick={() => void handleShare()}
          >
            {shareBusy ? 'Готовим картинку…' : 'Поделиться результатом'}
          </button>
          <Button
            type="button"
            className={`cta-shimmer border-0 !bg-none !from-transparent !to-transparent hover:!from-transparent hover:!to-transparent ${calmBtnClass}`}
            onClick={openCheckout}
          >
            {reportUnlocked ? 'Открыть расширенный отчёт' : 'Получить расширенный отчёт — 399 ₽'}
          </Button>
          <SupportFooter showDeveloperCredit={false} />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md space-y-5 pb-4">
        <SketchHighlightTitle accent={accent} generousOutline>
          Узнайте, что перегружает вашу когнитивную систему
        </SketchHighlightTitle>
        <p className="results-body text-center sm:text-left">
          и как это исправить — с помощью расширенного отчёта
          <br />
          на&nbsp;основе вашего&nbsp;индивидуального когнитивного профиля
        </p>
        <div className="calm-inset space-y-3">
          <p className="text-sm font-semibold text-white/90 sm:text-base">Что входит в отчёт:</p>
          <ul className="space-y-2.5 text-sm leading-relaxed text-white/88 sm:text-base">
            {reportFeatures.map((line) => (
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
    </CalmScreen>
    {latestResult ? (
      <PaymentCheckoutSheet
        open={checkoutOpen}
        product="full_report"
        sessionId={latestResult.id}
        onClose={() => setCheckoutOpen(false)}
        onPaid={() => {
          localStorage.setItem(reportPaidStorageKey(latestResult.id), '1');
          setStage('full-report');
        }}
        onNotice={setPayNotice}
      />
    ) : null}
    </>
  );
};
