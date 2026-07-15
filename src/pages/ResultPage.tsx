import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { Button } from '../components/Button';
import { CalmScreen } from '../components/results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { CabinetAccessLink } from '../components/CabinetAccessLink';
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
} from '../utils/paymentReturn';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import type { ReportUnlockProduct } from '../utils/paymentProductTypes';
import {
  isReportPaidUnlocked,
  reportPaidStorageKey,
  recoverProdamusPaymentFromUrl,
  recoverFullReportAccess,
} from '../utils/telegramPayments';

type ResultStep =
  | 'index'
  | 'index-detail'
  | 'measured'
  | 'report-offer'
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
      localStorage.setItem(reportPaidStorageKey(sid), '1');
      setStage('full-report');
    },
    [latestResult, setLatestResult, setStage],
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
    if (isReportPaidUnlocked(latestResult.id, serverPaymentsReady)) {
      unlockFullReport(latestResult.id);
      return;
    }
    if (!payerEmail) return;
    let cancelled = false;
    void syncSubscriptionAccessFromServer(payerEmail).then((active) => {
      if (cancelled) return;
      setSubscriptionSynced(true);
      if (active) unlockFullReport(latestResult.id);
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
    setStep('report-offer');
    void sendAnalyticsEventToSheets({
      eventType: 'payment_cancelled',
      sessionId: latestResult?.id ?? 'unknown',
      stage: 'result',
      screen: 'result/report-offer',
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
      const recovery =
        (await recoverRobokassaPaymentFromUrl()) ?? (await recoverProdamusPaymentFromUrl());
      if (!recovery?.sessionId) {
        if (hasPaymentReturnInUrl() || hasPendingRobokassaReturn()) {
          setPayNotice(
            'Оплата ещё не подтвердилась на сервере. Подождите минуту и нажмите «Проверить оплату» — или напишите hello@bookvolon.ru',
          );
          setStep('report-offer');
        }
        return;
      }
      const session = loadSessionFromHistory(recovery.sessionId);
      if (session) setLatestResult(session);
      if (isReportOfferProduct(recovery.product)) {
        localStorage.setItem(reportPaidStorageKey(recovery.sessionId), '1');
        setStage('full-report');
      }
    };
    void run();
  }, [latestResult?.id, skipNativePayment, setStage]);

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
  const accent = indexDisplayReady ? indexCategory.color : scoreAccentFromValue(a.index.value);

  /** Все 5 доменов индекса + итог (раньше скрывали 2 домена — индекс «не сходился» с экраном). */
  const measuredRows = [
    {
      label: 'Внимание',
      score: domains.find((d) => d.key === 'attentionStability')?.score ?? 50,
    },
    {
      label: 'Скорость реакции',
      score: domains.find((d) => d.key === 'reactionSpeed')?.score ?? 50,
    },
    {
      label: 'Стабильность реакции',
      score: domains.find((d) => d.key === 'reactionStability')?.score ?? 50,
    },
    {
      label: 'Когнитивная гибкость',
      score: domains.find((d) => d.key === 'cognitiveFlexibility')?.score ?? 50,
    },
    {
      label: 'Удержание информации',
      score: domains.find((d) => d.key === 'informationRetention')?.score ?? 50,
    },
    {
      label: 'Общий индекс',
      score: a.index.value,
    },
  ];

  const reportUnlocked = useMemo(
    () => isReportPaidUnlocked(latestResult.id, serverPaymentsReady),
    [latestResult.id, serverPaymentsReady, subscriptionSynced],
  );

  const goToReportGate = async () => {
    if (skipNativePayment || reportUnlocked) {
      unlockFullReport(latestResult.id);
      return;
    }
    if (payerEmail) {
      setReportGateBusy(true);
      try {
        const active = await syncSubscriptionAccessFromServer(payerEmail);
        setSubscriptionSynced(true);
        if (active) {
          unlockFullReport(latestResult.id);
          return;
        }
      } finally {
        setReportGateBusy(false);
      }
    }
    setStep('report-offer');
  };

  const retryPaymentRecovery = async () => {
    if (recoverBusy || !latestResult?.id) return;
    setRecoverBusy(true);
    setPayNotice('Проверяем оплату на сервере…');
    try {
      const fromUrl =
        (await recoverRobokassaPaymentFromUrl()) ?? (await recoverProdamusPaymentFromUrl());
      if (fromUrl?.sessionId) {
        const session = loadSessionFromHistory(fromUrl.sessionId);
        if (session) setLatestResult(session);
        if (isReportOfferProduct(fromUrl.product)) {
          localStorage.setItem(reportPaidStorageKey(fromUrl.sessionId), '1');
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
        localStorage.setItem(reportPaidStorageKey(recovered.sessionId), '1');
        setStage('full-report');
        return;
      }

      setPayNotice(
        recovered.message ||
          'Оплату пока не видим. Если деньги списались — напишите hello@bookvolon.ru с датой и email из чека.',
      );
    } finally {
      setRecoverBusy(false);
    }
  };

  const openCheckout = (product: ReportUnlockProduct = 'full_report') => {
    if (skipNativePayment || reportUnlocked) {
      unlockFullReport(latestResult.id);
      return;
    }
    setCheckoutProduct(product);
    setPayNotice(null);
    setCheckoutOpen(true);
  };

  const reportCheckoutSheet = (
    <PaymentCheckoutSheet
      open={checkoutOpen}
      product={checkoutProduct}
      sessionId={latestResult.id}
      onClose={() => setCheckoutOpen(false)}
      onPaid={unlockFullReport}
      onNotice={setPayNotice}
    />
  );

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
                Ограниченная достоверность замера. Рекомендуем пройти задания заново — так профиль
                станет точнее.
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
              <p className="mt-8 max-w-[min(22rem,92vw)] px-2 text-center text-base font-medium leading-relaxed text-white sm:mt-10 sm:text-lg">
                {indexCategory.humanPhrase}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mx-auto max-w-[min(22rem,92vw)] px-2 text-center text-base font-semibold leading-relaxed text-white sm:text-lg">
            {indexCategory.category}
          </p>
        )}
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
        contentAlign="readable"
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
        <div className="mx-auto w-full max-w-md space-y-5">
          <SketchHighlightTitle accent={accent}>Что мы измерили</SketchHighlightTitle>
          {!indexDisplayReady ? (
            <p className="text-sm leading-relaxed text-amber-200/90">
              Ограниченная достоверность замера. Рекомендуем пройти задания заново, чтобы увидеть
              цифры по каждому показателю.
            </p>
          ) : null}
          <div className="calm-inset space-y-3">
            {measuredRows.map((row) => {
              const rowAccent = scoreAccentFromValue(row.score);
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-base leading-relaxed sm:text-lg"
                >
                  <span className="text-white/88">{row.label}</span>
                  {indexDisplayReady ? (
                    <span
                      className="shrink-0 text-2xl font-bold tabular-nums sm:text-3xl"
                      style={{ color: rowAccent }}
                    >
                      {row.score}
                    </span>
                  ) : (
                    <span className="shrink-0 text-2xl font-semibold tabular-nums text-white/35 sm:text-3xl">
                      —
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CalmScreen>
    );
  }

  if (step === 'report-offer') {
    return (
      <>
        <CalmScreen
          contentAlign="readable"
          footer={
            <div className="space-y-3">
              {payNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/90">{payNotice}</p>
              ) : null}
              {!reportUnlocked && (hasPaymentReturnInUrl() || hasPendingRobokassaReturn()) ? (
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
              {reportUnlocked ? (
                <Button
                  type="button"
                  variant="sell"
                  className={calmBtnClass}
                  onClick={() => unlockFullReport(latestResult.id)}
                >
                  Открыть расшифровку
                </Button>
              ) : null}
              <CabinetAccessLink variant="button" />
            </div>
          }
        >
          <ReportTariffOffer
            reportUnlocked={reportUnlocked}
            onSelect={(product) => openCheckout(product)}
          />
        </CalmScreen>
        {reportCheckoutSheet}
      </>
    );
  }

  if (step === 'complete') {
    return <AssessmentCompleteScreen onDone={onRestart} />;
  }

  return null;
};
