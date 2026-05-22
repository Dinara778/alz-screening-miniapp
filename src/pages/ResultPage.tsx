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
import type { DomainInterpretationCopy } from '../copy/cognitiveDomainInterpretations';
import { buildCognitiveAnalytics, type DomainScore } from '../utils/cognitiveAnalytics';
import { getIndexCategory, isIndexDisplayReady } from '../utils/indexCategory';
import { getFreeIndexInterpretation, type FreeIndexInterpretation } from '../utils/freeIndexInterpretation';
import { formatParticipantFirstName, formatPersonalizedHeading } from '../utils/participantDisplayName';
import { shareResultWithCard } from '../utils/shareResult';
import { shouldBypassReportPayment } from '../utils/paymentStub';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { hasPaymentReturnInUrl } from '../utils/storage';
import {
  consultationPaidStorageKey,
  isReportPaidUnlocked,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
  reportPaidStorageKey,
  recoverProdamusPaymentFromUrl,
} from '../utils/telegramPayments';

type ResultStep = 'index' | 'index-detail' | 'domain-metric' | 'domain-detail' | 'hub' | 'session-offer';

const sessionUpsellFeatures = [
  'Онлайн-расшифровку результатов простым языком с опытным экспертом по когнитивной устойчивости (созвон)',
  'Персональные рекомендации под вашу ситуацию',
  'Понимание, что больше всего мешает вашему ресурсу',
  'План улучшения показателей',
] as const;

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
      <div className="calm-inset space-y-4 text-left text-base leading-relaxed text-white sm:text-lg">
        <p>
          <span className="font-semibold">В жизни: </span>
          {inLife}
        </p>
        <p>
          <span className="font-semibold">Как проявляется: </span>
          {manifestations}
        </p>
        <p>
          <span className="font-semibold">О чём говорит результат: </span>
          {aboutResult}
        </p>
      </div>
    </div>
  );
};

const FreeIndexInterpretationBody = ({
  title,
  interpretation,
  accent,
}: {
  title: string;
  interpretation: FreeIndexInterpretation;
  accent: string;
}) => (
  <div className="mx-auto w-full max-w-md space-y-4">
    <SketchHighlightTitle accent={accent}>{title}</SketchHighlightTitle>
    <div className="calm-inset space-y-4 text-left text-base leading-relaxed text-white sm:text-lg">
      <p>
        <span className="font-semibold">В жизни: </span>
        {interpretation.inLife}
      </p>
      {interpretation.feeling ? (
        <p>
          <span className="font-semibold">Как это ощущается: </span>
          {interpretation.feeling}
        </p>
      ) : null}
      {interpretation.insight ? (
        <p>
          <span className="font-semibold">О чём говорит результат: </span>
          {interpretation.insight}
        </p>
      ) : null}
    </div>
  </div>
);

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, participant, setStage, resultEntryStep, clearResultEntryStep, serverPaymentsReady } =
    useApp();
  useHydrateLatestResult();
  const [step, setStep] = useState<ResultStep>('index');
  const [domainIndex, setDomainIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sessionCheckoutOpen, setSessionCheckoutOpen] = useState(false);
  const [sessionPaid, setSessionPaid] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resultEntryStep === 'session-offer') {
      setStep('session-offer');
      clearResultEntryStep();
    } else if (resultEntryStep === 'hub') {
      setStep('hub');
      clearResultEntryStep();
    }
  }, [resultEntryStep, clearResultEntryStep]);

  useEffect(() => {
    if (!latestResult?.id) return;
    setSessionPaid(localStorage.getItem(consultationPaidStorageKey(latestResult.id)) === '1');
  }, [latestResult?.id]);
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
  const indexDisplayReady = isIndexDisplayReady(
    a.index.value,
    a.validation.interpretationTrusted,
    a.index.granularId,
  );
  const indexCategory = indexDisplayReady
    ? getIndexCategory(a.index.value)
    : getIndexCategory(Number.NaN);
  const freeIndexInterpretation = indexDisplayReady
    ? getFreeIndexInterpretation(a.index.value)
    : getFreeIndexInterpretation(Number.NaN);
  const displayName = formatParticipantFirstName(
    latestResult.participant?.name ?? participant?.name,
  );
  const accent = indexDisplayReady ? indexCategory.color : scoreAccentFromValue(a.index.value);
  const skipNativePayment = shouldBypassReportPayment(serverPaymentsReady);

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

  const reportUnlocked = latestResult
    ? isReportPaidUnlocked(latestResult.id, serverPaymentsReady)
    : false;

  const openCheckout = () => {
    if (!latestResult) return;
    if (skipNativePayment || reportUnlocked) {
      unlockFullReport();
      return;
    }
    setPayNotice(null);
    setCheckoutOpen(true);
  };

  const openSessionCheckout = () => {
    if (!latestResult) return;
    setPayNotice(null);
    setSessionCheckoutOpen(true);
  };

  const markSessionPaid = () => {
    if (!latestResult) return;
    localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
    window.dispatchEvent(new Event('consultation-paid'));
    setSessionPaid(true);
    setSessionCheckoutOpen(false);
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
        kicker={
          <>
            {displayName ? (
              <>
                <span className="font-bold">{displayName}</span>,{' '}
              </>
            ) : null}
            {displayName ? 'ваш' : 'Ваш'} когнитивный профиль{' '}
            <strong className="font-bold">прямо сейчас</strong>:{' '}
            <span className="font-bold" style={{ color: indexCategory.color }}>
              {indexCategory.category}
            </span>
          </>
        }
        kickerProfile
        footer={
          <>
            {!indexDisplayReady ? (
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
        <p className="mb-5 max-w-[min(22rem,92vw)] text-center text-xs leading-relaxed text-white/50 sm:mb-6 sm:text-sm">
          * профиль меняется в течение дня
        </p>
        {indexDisplayReady ? (
          <>
            <OrganicMetricHalo accent={accent} emphasis>
              <span className="inline-flex items-baseline justify-center gap-0.5 tabular-nums leading-none">
                <span
                  className="text-[clamp(3.25rem,16vw,4.75rem)] font-bold tracking-tight"
                  style={{ color: indexCategory.color }}
                >
                  {a.index.value}
                </span>
                <span
                  className="text-[clamp(0.75rem,3.2vw,1rem)] font-medium opacity-70"
                  style={{ color: indexCategory.color }}
                >
                  /100
                </span>
              </span>
            </OrganicMetricHalo>
            {indexCategory.humanPhrase ? (
              <p
                className="mt-8 max-w-[min(22rem,92vw)] px-2 text-center text-base font-medium leading-relaxed sm:mt-10 sm:text-lg"
                style={{ color: indexCategory.color }}
              >
                {indexCategory.humanPhrase}
              </p>
            ) : null}
          </>
        ) : (
          <p
            className="mx-auto max-w-[min(22rem,92vw)] px-2 text-center text-base font-semibold leading-relaxed sm:text-lg"
            style={{ color: indexCategory.color }}
          >
            {indexCategory.category}
          </p>
        )}
      </CalmScreen>
    );
  }

  if (step === 'index-detail') {
    return (
      <CalmScreen
        kicker={
          displayName ? (
            <>
              <span className="font-bold">{displayName}</span>, индекс когнитивной устойчивости
            </>
          ) : (
            'Индекс когнитивной устойчивости'
          )
        }
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={startDomains}>
            Далее — показатели профиля
          </Button>
        }
      >
        <FreeIndexInterpretationBody
          title={indexCategory.category}
          interpretation={freeIndexInterpretation}
          accent={accent}
        />
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
          title={formatPersonalizedHeading(displayName, d.title)}
          interpretation={d.interpretation}
          accent={scoreAccentFromValue(d.score)}
        />
      </CalmScreen>
    );
  }

  if (step === 'session-offer') {
    return (
      <>
        <CalmScreen
          contentAlign="readable"
          footer={
            <div className="flex flex-col gap-3">
              {sessionPaid ? (
                <Button type="button" className={calmBtnClass} onClick={() => setStep('hub')}>
                  Назад к результатам
                </Button>
              ) : (
                <>
                  <p className="text-center text-sm leading-relaxed text-white/55">
                    После оформления заказа мы с вами свяжемся в течение 15 минут.
                  </p>
                  <Button type="button" variant="sell" className={calmBtnClass} onClick={openSessionCheckout}>
                    Купить сессию - 5 490 руб.
                  </Button>
                  <button type="button" className={calmBtnGhost} onClick={() => setStep('hub')}>
                    Назад к результатам
                  </button>
                </>
              )}
              {payNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/90">{payNotice}</p>
              ) : null}
            </div>
          }
        >
          <div className="mx-auto w-full max-w-md space-y-5">
            {sessionPaid ? (
              <>
                <p className="text-lg font-semibold text-emerald-200">Спасибо за оплату!</p>
                <p className="results-body leading-relaxed">
                  Мы свяжемся с вами в течение 15 минут для записи на сессию.
                </p>
              </>
            ) : (
              <>
                <SketchHighlightTitle accent={accent} generousOutline tuckBottomOutline className="mb-3">
                  Разобрать результаты с экспертом
                </SketchHighlightTitle>
                <p className="results-body">
                  30-минутная сессия по вашему когнитивному профилю с экспертом по когнитивной устойчивости.
                </p>
                <div className="calm-inset space-y-3">
                  <p className="text-sm font-semibold text-white/90 sm:text-base">Что вы получите:</p>
                  <ul className="space-y-2.5 text-sm leading-relaxed text-white/88 sm:text-base">
                    {sessionUpsellFeatures.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="shrink-0 text-emerald-400" aria-hidden>
                          ✓
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </CalmScreen>
        {latestResult ? (
          <PaymentCheckoutSheet
            open={sessionCheckoutOpen}
            product="consultation"
            sessionId={latestResult.id}
            onClose={() => setSessionCheckoutOpen(false)}
            onPaid={markSessionPaid}
            onNotice={setPayNotice}
          />
        ) : null}
      </>
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
            {reportUnlocked
              ? 'Открыть расширенный отчёт'
              : `Получить расширенный отчёт — ${PAYMENT_PRODUCTS.full_report.priceRub} ₽`}
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
        onPaid={unlockFullReport}
        onNotice={setPayNotice}
      />
    ) : null}
    </>
  );
};
