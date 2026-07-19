import { useCallback, useEffect, useState } from 'react';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { Button } from '../components/Button';
import { CalmScreen } from '../components/results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { DomainOverviewTiles } from '../components/results/DomainOverviewTiles';
import { AssessmentCompleteScreen } from '../components/AssessmentCompleteScreen';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { getIndexCategory, isIndexDisplayReady } from '../utils/indexCategory';
import { getFreeIndexInterpretation } from '../utils/freeIndexInterpretation';
import { formatParticipantFirstName } from '../utils/participantDisplayName';
import { shouldBypassReportPayment } from '../utils/paymentStub';
import {
  INTERPRETATION_LABEL_ABOUT_RESULT,
  INTERPRETATION_LABEL_FEELING,
  INTERPRETATION_LABEL_IN_LIFE,
} from '../copy/interpretationLabels';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { ReportTariffOffer } from '../components/ReportTariffOffer';
import { SubscriptionUpsellScreen } from '../components/SubscriptionUpsellScreen';
import { hasPaymentReturnInUrl, loadSessionFromHistory } from '../utils/storage';
import {
  recoverRobokassaPaymentFromUrl,
  syncSubscriptionAccessFromServer,
} from '../utils/webPayments';
import {
  consumePaymentFailNotice,
  hasPendingRobokassaReturn,
  isReportOfferProduct,
  PAYMENT_FAIL_NOTICE_TEXT,
  peekRobokassaReturnProduct,
  peekRobokassaReturnSessionId,
} from '../utils/paymentReturn';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import type { ReportUnlockProduct } from '../utils/paymentProductTypes';
import { isSubscriptionProduct } from '../utils/paymentProductTypes';
import { isSubscriptionActiveLocal } from '../utils/subscriptionAccess';
import {
  confirmReportAccess,
  grantReportAccess,
  reportPaidStorageKey,
} from '../utils/paymentAccess';
import {
  recoverProdamusPaymentFromUrl,
  recoverFullReportAccess,
} from '../utils/telegramPayments';

type ResultStep =
  | 'index'
  | 'index-detail'
  | 'measured'
  | 'report-offer'
  | 'subscription-offer'
  | 'complete';

const calmBtnClass = CTA_BUTTON_CLASS;
const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

const FreeIndexInterpretationBody = ({
  title,
  interpretation,
  accent,
}: {
  title: string;
  interpretation: ReturnType<typeof getFreeIndexInterpretation>;
  accent: string;
}) => (
  <div className="mx-auto w-full max-w-md space-y-4">
    <SketchHighlightTitle accent={accent}>{title}</SketchHighlightTitle>
    <div className="calm-inset results-prose text-left text-base leading-relaxed text-white sm:text-lg">
      <p>
        <span className="interpretation-label">{INTERPRETATION_LABEL_IN_LIFE} </span>
        {interpretation.inLife}
      </p>
      {interpretation.feeling ? (
        <p>
          <span className="interpretation-label">{INTERPRETATION_LABEL_FEELING} </span>
          {interpretation.feeling}
        </p>
      ) : null}
      {interpretation.insight ? (
        <p>
          <span className="interpretation-label">{INTERPRETATION_LABEL_ABOUT_RESULT} </span>
          {interpretation.insight}
        </p>
      ) : null}
    </div>
  </div>
);

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const {
    latestResult,
    participant,
    setStage,
    setLatestResult,
    resultEntryStep,
    clearResultEntryStep,
    serverPaymentsReady,
    setAnalyticsScreenDetail,
  } = useApp();
  useHydrateLatestResult();
  const [step, setStep] = useState<ResultStep>('index');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<ReportUnlockProduct>('full_report');
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [reportGateBusy, setReportGateBusy] = useState(false);
  const [subscriptionSynced, setSubscriptionSynced] = useState(false);

  const [reportAccessConfirmed, setReportAccessConfirmed] = useState(false);

  const skipNativePayment = shouldBypassReportPayment(serverPaymentsReady);

  const payerEmail =
    latestResult?.participant?.email?.trim() || participant?.email?.trim() || '';

  const unlockFullReport = useCallback(
    (paidSessionId?: string) => {
      const sid = paidSessionId ?? latestResult?.id;
      if (!sid) return;
      const session =
        latestResult?.id === sid ? latestResult : loadSessionFromHistory(sid) ?? latestResult;
      if (session) setLatestResult(session);
      grantReportAccess(sid);
      setStage('full-report');
    },
    [latestResult, setLatestResult, setStage],
  );

  /** После разового отчёта: оплата подписки → тот же финал, что и после подписки. */
  const finishAfterSubscriptionUpsell = useCallback(
    (paidSessionId?: string) => {
      const sid = paidSessionId ?? latestResult?.id;
      if (sid) {
        const session =
          latestResult?.id === sid ? latestResult : loadSessionFromHistory(sid) ?? latestResult;
        if (session) setLatestResult(session);
        grantReportAccess(sid);
      }
      setCheckoutOpen(false);
      setStep('complete');
    },
    [latestResult, setLatestResult],
  );

  useEffect(() => {
    setAnalyticsScreenDetail(step);
  }, [step, setAnalyticsScreenDetail]);

  useEffect(() => {
    if (!latestResult?.id || skipNativePayment || !payerEmail) return;
    void syncSubscriptionAccessFromServer(payerEmail).then(() => {
      setSubscriptionSynced(true);
    });
  }, [latestResult?.id, payerEmail, skipNativePayment]);

  useEffect(() => {
    if (step !== 'report-offer' || skipNativePayment || !latestResult?.id) return;
    let cancelled = false;
    void confirmReportAccess({
      sessionId: latestResult.id,
      payerEmail,
      serverPaymentsReady,
    }).then((confirmed) => {
      if (cancelled) return;
      setSubscriptionSynced(true);
      setReportAccessConfirmed(confirmed);
      if (confirmed) unlockFullReport(latestResult.id);
    });
    return () => {
      cancelled = true;
    };
  }, [
    step,
    latestResult?.id,
    payerEmail,
    skipNativePayment,
    serverPaymentsReady,
    unlockFullReport,
  ]);

  useEffect(() => {
    if (!consumePaymentFailNotice()) return;
    const failedProduct = peekRobokassaReturnProduct();
    setPayNotice(PAYMENT_FAIL_NOTICE_TEXT);
    setStep(isSubscriptionProduct(failedProduct ?? '') ? 'subscription-offer' : 'report-offer');
    void sendAnalyticsEventToSheets({
      eventType: 'payment_cancelled',
      sessionId: latestResult?.id ?? 'unknown',
      stage: 'result',
      screen: isSubscriptionProduct(failedProduct ?? '')
        ? 'result/subscription-offer'
        : 'result/report-offer',
      participant: participant ?? undefined,
      product: failedProduct,
      channel: 'web',
      reason: 'robokassa_fail_return',
    }).catch(() => {
      /* ignore */
    });
  }, [participant, latestResult?.id]);

  useEffect(() => {
    if (resultEntryStep === 'complete') {
      setStep('complete');
      clearResultEntryStep();
      return;
    }
    if (resultEntryStep === 'subscription-offer') {
      setStep(isSubscriptionActiveLocal(payerEmail) ? 'complete' : 'subscription-offer');
      clearResultEntryStep();
    }
  }, [resultEntryStep, clearResultEntryStep]);

  useEffect(() => {
    if (
      !latestResult?.id ||
      skipNativePayment ||
      (!hasPaymentReturnInUrl() && !hasPendingRobokassaReturn())
    ) {
      return;
    }
    const run = async () => {
      const pendingSid =
        peekRobokassaReturnSessionId() ?? latestResult.id;
      let hadOneTimePaid = false;
      try {
        hadOneTimePaid =
          localStorage.getItem(reportPaidStorageKey(pendingSid)) === '1';
      } catch {
        hadOneTimePaid = false;
      }
      const recovery =
        (await recoverRobokassaPaymentFromUrl()) ?? (await recoverProdamusPaymentFromUrl());
      if (!recovery?.sessionId) {
        if (hasPaymentReturnInUrl() || hasPendingRobokassaReturn()) {
          setPayNotice(
            'Оплата ещё не подтвердилась на сервере. Подождите минуту и нажмите «Проверить оплату» — или напишите hello@cortalab.ru',
          );
          const failedProduct = peekRobokassaReturnProduct();
          setStep(
            isSubscriptionProduct(failedProduct ?? '') ? 'subscription-offer' : 'report-offer',
          );
        }
        return;
      }
      const session = loadSessionFromHistory(recovery.sessionId);
      if (session) setLatestResult(session);
      if (isReportOfferProduct(recovery.product)) {
        grantReportAccess(recovery.sessionId);
        // Подписка после уже оплаченного разового отчёта → финальный экран, не отчёт заново
        if (isSubscriptionProduct(recovery.product) && hadOneTimePaid) {
          setStep('complete');
          return;
        }
        setStage('full-report');
      }
    };
    void run();
  }, [latestResult?.id, skipNativePayment, setStage, serverPaymentsReady]);

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
  const indexKickerCategory = displayName
    ? indexCategory.category.replace(/^./, (char) => char.toLowerCase())
    : indexCategory.category;
  const accent = indexDisplayReady ? indexCategory.color : scoreAccentFromValue(a.index.value);

  const openPaidReport = () => {
    void confirmReportAccess({
      sessionId: latestResult.id,
      payerEmail,
      serverPaymentsReady,
    }).then((confirmed) => {
        if (confirmed) unlockFullReport(latestResult.id);
      },
    );
  };

  const goToReportGate = async () => {
    if (skipNativePayment) {
      unlockFullReport(latestResult.id);
      return;
    }
    setReportGateBusy(true);
    try {
      void syncSubscriptionAccessFromServer(payerEmail).then(() => setSubscriptionSynced(true));
      const confirmed = await confirmReportAccess({
        sessionId: latestResult.id,
        payerEmail,
        serverPaymentsReady,
      });
      if (confirmed) {
        unlockFullReport(latestResult.id);
        return;
      }
    } finally {
      setReportGateBusy(false);
    }
    setStep('report-offer');
  };

  const retryPaymentRecovery = async () => {
    if (recoverBusy || !latestResult?.id) return;
    setRecoverBusy(true);
    setPayNotice('Проверяем оплату на сервере…');
    try {
      let hadOneTimePaid = false;
      try {
        hadOneTimePaid =
          localStorage.getItem(reportPaidStorageKey(latestResult.id)) === '1';
      } catch {
        hadOneTimePaid = false;
      }
      const fromUrl =
        (await recoverRobokassaPaymentFromUrl()) ?? (await recoverProdamusPaymentFromUrl());
      if (fromUrl?.sessionId) {
        const session = loadSessionFromHistory(fromUrl.sessionId);
        if (session) setLatestResult(session);
        if (isReportOfferProduct(fromUrl.product)) {
          grantReportAccess(fromUrl.sessionId);
          if (isSubscriptionProduct(fromUrl.product) && hadOneTimePaid) {
            setStep('complete');
            return;
          }
          setStage('full-report');
          return;
        }
        return;
      }

      const payerEmail =
        latestResult.participant?.email?.trim() || participant?.email?.trim();
      const recovered = await recoverFullReportAccess(latestResult.id, payerEmail);
      if (recovered.ok) {
        const session = loadSessionFromHistory(recovered.sessionId);
        if (session) setLatestResult(session);
        grantReportAccess(recovered.sessionId);
        if (isSubscriptionActiveLocal(payerEmail) && hadOneTimePaid) {
          setStep('complete');
          return;
        }
        setStage('full-report');
        return;
      }

      setPayNotice(
        recovered.message ||
          'Оплату пока не видим. Если деньги списались — напишите hello@cortalab.ru с датой и email из чека.',
      );
    } finally {
      setRecoverBusy(false);
    }
  };

  const openCheckout = (product: ReportUnlockProduct = 'full_report') => {
    if (skipNativePayment) {
      if (isSubscriptionProduct(product) && step === 'subscription-offer') {
        finishAfterSubscriptionUpsell(latestResult.id);
        return;
      }
      unlockFullReport(latestResult.id);
      return;
    }
    setCheckoutProduct(product);
    setPayNotice(null);
    setCheckoutOpen(true);
  };

  const handleCheckoutPaid = (paidSessionId?: string) => {
    if (isSubscriptionProduct(checkoutProduct) && step === 'subscription-offer') {
      finishAfterSubscriptionUpsell(paidSessionId);
      return;
    }
    unlockFullReport(paidSessionId);
  };

  const reportCheckoutSheet = (
    <PaymentCheckoutSheet
      open={checkoutOpen}
      product={checkoutProduct}
      sessionId={latestResult.id}
      onClose={() => setCheckoutOpen(false)}
      onPaid={handleCheckoutPaid}
      onNotice={setPayNotice}
    />
  );

  if (step === 'index') {
    return (
      <CalmScreen
        contentAlign="index"
        footer={
          <>
            {indexDisplayReady ? (
              <div className="index-hero-bottom">
                {indexCategory.humanPhrase ? (
                  <p className="index-human-phrase">{indexCategory.humanPhrase}</p>
                ) : null}
                <p className="index-repeat-hint" role="note">
                  <span className="index-repeat-hint-icon" aria-hidden>
                    ☀️
                  </span>
                  <span>
                    Завтра утром повторите оценку — увидите, насколько мозг восстановился после сна.
                  </span>
                </p>
              </div>
            ) : null}
            {!indexDisplayReady ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/90">
                Ограниченная достоверность замера. Рекомендуем пройти задания заново — так профиль
                станет точнее.
              </p>
            ) : null}
            <Button type="button" className={calmBtnClass} onClick={() => setStep('index-detail')}>
              Узнать, что это значит
            </Button>
            <button type="button" className={calmBtnGhost} onClick={onRestart}>
              На главную
            </button>
          </>
        }
      >
        <div className="index-hero">
          <div className="index-hero-top">
            <p className="index-hero-title">
              {displayName ? (
                <>
                  <span className="font-bold text-white">{displayName}</span>
                  {', '}
                </>
              ) : null}
              <span className="font-semibold" style={{ color: indexCategory.color }}>
                {indexKickerCategory}
              </span>
            </p>
          </div>

          {indexDisplayReady ? (
            <>
              <div className="index-hero-halo">
                <OrganicMetricHalo accent={accent} emphasis>
                  <span className="inline-flex items-baseline justify-center gap-0.5 tabular-nums leading-none">
                    <span
                      className="text-[clamp(3.5rem,18vw,5.25rem)] font-bold tracking-tight"
                      style={{ color: indexCategory.color }}
                    >
                      {a.index.value}
                    </span>
                    <span
                      className="text-[clamp(0.8rem,3.4vw,1.05rem)] font-medium opacity-70"
                      style={{ color: indexCategory.color }}
                    >
                      /100
                    </span>
                  </span>
                </OrganicMetricHalo>
              </div>
            </>
          ) : (
            <p className="mx-auto max-w-[min(22rem,92vw)] px-2 text-center text-sm font-semibold leading-snug text-white">
              {indexCategory.category}
            </p>
          )}
        </div>
      </CalmScreen>
    );
  }

  if (step === 'index-detail') {
    return (
      <CalmScreen
        kicker="Индекс когнитивной устойчивости"
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={() => setStep('measured')}>
            Узнать больше
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

  if (step === 'measured') {
    return (
      <CalmScreen
        contentAlign="center"
        footer={
          <Button
            type="button"
            className={calmBtnClass}
            disabled={reportGateBusy}
            onClick={() => void goToReportGate()}
          >
            {reportGateBusy ? 'Проверяем подписку…' : 'Далее'}
          </Button>
        }
      >
        <div className="w-full">
          {!indexDisplayReady ? (
            <p className="mb-3 px-1 text-center text-xs leading-relaxed text-amber-200/90">
              Ограниченная достоверность замера. Рекомендуем пройти задания заново.
            </p>
          ) : null}
          <DomainOverviewTiles
            domains={domains}
            indexValue={a.index.value}
            ready={indexDisplayReady}
          />
        </div>
      </CalmScreen>
    );
  }

  if (step === 'report-offer') {
    return (
      <>
        <CalmScreen
          contentAlign="center"
          footer={
            <div className="space-y-3">
              {payNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/90">{payNotice}</p>
              ) : null}
              {!reportAccessConfirmed && (hasPaymentReturnInUrl() || hasPendingRobokassaReturn()) ? (
                <Button
                  type="button"
                  variant="secondary"
                  className={calmBtnGhost}
                  disabled={recoverBusy}
                  onClick={() => void retryPaymentRecovery()}
                >
                  {recoverBusy ? 'Проверяем оплату…' : 'Проверить оплату и открыть отчёт'}
                </Button>
              ) : null}
              {reportAccessConfirmed ? (
                <Button
                  type="button"
                  variant="sell"
                  className={calmBtnClass}
                  onClick={openPaidReport}
                >
                  Открыть расшифровку
                </Button>
              ) : null}
            </div>
          }
        >
          <ReportTariffOffer
            reportUnlocked={reportAccessConfirmed}
            onSelect={(product) => openCheckout(product)}
          />
        </CalmScreen>
        {reportCheckoutSheet}
      </>
    );
  }

  if (step === 'subscription-offer') {
    return (
      <>
        <SubscriptionUpsellScreen
          onSubscribe={() => openCheckout('subscription_1m')}
          onSkip={() => setStep('complete')}
        />
        {reportCheckoutSheet}
      </>
    );
  }

  if (step === 'complete') {
    return <AssessmentCompleteScreen onDone={onRestart} />;
  }

  return null;
};
