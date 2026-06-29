import { useEffect, useState } from 'react';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { Button } from '../components/Button';
import { CalmScreen } from '../components/results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { SupportFooter } from '../components/SupportFooter';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { getIndexCategory, isIndexDisplayReady } from '../utils/indexCategory';
import { getFreeIndexInterpretation } from '../utils/freeIndexInterpretation';
import { formatParticipantFirstName } from '../utils/participantDisplayName';
import { shareResultWithCard } from '../utils/shareResult';
import { shouldBypassReportPayment } from '../utils/paymentStub';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import {
  INTERPRETATION_LABEL_ABOUT_RESULT,
  INTERPRETATION_LABEL_FEELING,
  INTERPRETATION_LABEL_IN_LIFE,
} from '../copy/interpretationLabels';
import {
  consumePaymentFailNotice,
  CONSULTATION_PAID_THANKS_TEXT,
  hasPendingRobokassaReturn,
  PAYMENT_FAIL_NOTICE_TEXT,
  peekRobokassaReturnProduct,
} from '../utils/paymentReturn';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { hasPaymentReturnInUrl, loadSessionFromHistory } from '../utils/storage';
import { recoverRobokassaPaymentFromUrl } from '../utils/webPayments';
import {
  consultationPaidStorageKey,
  isReportPaidUnlocked,
  reportPaidStorageKey,
  recoverProdamusPaymentFromUrl,
} from '../utils/telegramPayments';

type ResultStep = 'index' | 'index-detail' | 'measured' | 'report-offer' | 'hub' | 'session-offer';

const sessionUpsellFeatures = [
  'Онлайн-расшифровку результатов простым языком с опытным экспертом по когнитивной устойчивости (созвон)',
  'Персональные рекомендации под вашу ситуацию',
  'Понимание, что больше всего мешает вашему ресурсу',
  'План улучшения показателей',
] as const;

const reportOfferBullets = [
  'Расшифровку вашего когнитивного статуса',
  'Технику по улучшению когнитивного состояния по наиболее проседающему домену, которую вы можете сделать прямо сейчас',
  'Краткие персональные рекомендации, которые помогут снять перегрузку и быстрее вернуть когнитивный ресурс',
] as const;

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
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sessionCheckoutOpen, setSessionCheckoutOpen] = useState(false);
  const [sessionPaid, setSessionPaid] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);

  useEffect(() => {
    setAnalyticsScreenDetail(step);
  }, [step, setAnalyticsScreenDetail]);

  useEffect(() => {
    if (!consumePaymentFailNotice()) return;
    const failedProduct = peekRobokassaReturnProduct();
    setPayNotice(PAYMENT_FAIL_NOTICE_TEXT);
    setStep(failedProduct === 'consultation' ? 'session-offer' : 'report-offer');
    void sendAnalyticsEventToSheets({
      eventType: 'payment_cancelled',
      sessionId: latestResult?.id ?? 'unknown',
      stage: 'result',
      screen: failedProduct === 'consultation' ? 'result/session-offer' : 'result/report-offer',
      participant: participant ?? undefined,
      product: failedProduct,
      channel: 'web',
      reason: 'robokassa_fail_return',
    }).catch(() => {
      /* ignore */
    });
  }, [participant, latestResult?.id]);

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

  const skipNativePayment = shouldBypassReportPayment(serverPaymentsReady);

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
          const pendingProduct = peekRobokassaReturnProduct();
          setPayNotice(
            'Оплата ещё не подтвердилась на сервере. Подождите минуту и нажмите «Проверить оплату» — или напишите hello@bookvolon.ru',
          );
          setStep(pendingProduct === 'consultation' ? 'session-offer' : 'report-offer');
        }
        return;
      }
      const session = loadSessionFromHistory(recovery.sessionId);
      if (session) setLatestResult(session);
      if (recovery.product === 'consultation') {
        localStorage.setItem(consultationPaidStorageKey(recovery.sessionId), '1');
        window.dispatchEvent(new Event('consultation-paid'));
        setSessionPaid(true);
        setStep('session-offer');
        return;
      }
      if (recovery.product !== 'full_report') return;
      localStorage.setItem(reportPaidStorageKey(recovery.sessionId), '1');
      setStage('full-report');
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
  const reportPriceRub = PAYMENT_PRODUCTS.full_report.priceRub;

  const measuredRows = [
    {
      label: 'Внимание',
      score: domains.find((d) => d.key === 'attentionStability')?.score ?? 0,
    },
    {
      label: 'Скорость реакции',
      score: domains.find((d) => d.key === 'reactionSpeed')?.score ?? 0,
    },
    {
      label: 'Удержание информации',
      score: domains.find((d) => d.key === 'informationRetention')?.score ?? 0,
    },
    {
      label: 'Когнитивная устойчивость',
      score: a.index.value,
    },
  ];

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

  const unlockFullReport = (paidSessionId?: string) => {
    const sid = paidSessionId ?? latestResult?.id;
    if (!sid) return;
    const session =
      latestResult?.id === sid ? latestResult : loadSessionFromHistory(sid) ?? latestResult;
    if (session) setLatestResult(session);
    localStorage.setItem(reportPaidStorageKey(sid), '1');
    setStage('full-report');
  };

  const reportUnlocked = isReportPaidUnlocked(latestResult.id, serverPaymentsReady);

  const retryPaymentRecovery = async () => {
    if (recoverBusy || !latestResult?.id) return;
    setRecoverBusy(true);
    setPayNotice('Проверяем оплату на сервере…');
    try {
      const recovery =
        (await recoverRobokassaPaymentFromUrl()) ?? (await recoverProdamusPaymentFromUrl());
      if (!recovery?.sessionId) {
        setPayNotice(
          'Оплату пока не видим. Если деньги списались — напишите hello@bookvolon.ru с датой и email из чека.',
        );
        return;
      }
      const session = loadSessionFromHistory(recovery.sessionId);
      if (session) setLatestResult(session);
      if (recovery.product === 'full_report') {
        localStorage.setItem(reportPaidStorageKey(recovery.sessionId), '1');
        setStage('full-report');
        return;
      }
      if (recovery.product === 'consultation') {
        localStorage.setItem(consultationPaidStorageKey(recovery.sessionId), '1');
        window.dispatchEvent(new Event('consultation-paid'));
        setSessionPaid(true);
        setStep('session-offer');
        setPayNotice(null);
      }
    } finally {
      setRecoverBusy(false);
    }
  };

  const openCheckout = () => {
    if (skipNativePayment || reportUnlocked) {
      unlockFullReport(latestResult.id);
      return;
    }
    setPayNotice(null);
    setCheckoutOpen(true);
  };

  const openSessionCheckout = () => {
    setPayNotice(null);
    setSessionCheckoutOpen(true);
  };

  const markSessionPaid = () => {
    localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
    window.dispatchEvent(new Event('consultation-paid'));
    setSessionPaid(true);
    setSessionCheckoutOpen(false);
    void sendAnalyticsEventToSheets({
      eventType: 'consultation_paid',
      sessionId: latestResult.id,
      stage: 'result',
      screen: 'result/session-offer',
      participant: participant ?? undefined,
      product: 'consultation',
    }).catch(() => {});
  };

  const reportCheckoutSheet = (
    <PaymentCheckoutSheet
      open={checkoutOpen}
      product="full_report"
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
          <Button type="button" className={calmBtnClass} onClick={() => setStep('report-offer')}>
            Далее
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
              <Button type="button" variant="sell" className={calmBtnClass} onClick={openCheckout}>
                {reportUnlocked ? 'Открыть расшифровку' : `Восстановить ресурс — ${reportPriceRub} ₽`}
              </Button>
            </div>
          }
        >
          <div className="mx-auto w-full max-w-md results-prose space-y-5">
            <p className="app-heading leading-snug text-white/95">
              Узнайте, почему сейчас мозг работает именно так и что поможет быстрее восстановить
              ресурс
            </p>
            <div className="calm-inset space-y-3 text-base leading-relaxed text-white/88 sm:text-lg">
              <p>Внутри вы получите:</p>
              <ul className="space-y-3">
                {reportOfferBullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="shrink-0 text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CalmScreen>
        {reportCheckoutSheet}
      </>
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
                  Вернуться
                </Button>
              ) : (
                <>
                  {!sessionPaid && (hasPaymentReturnInUrl() || hasPendingRobokassaReturn()) ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className={calmBtnGhost}
                      disabled={recoverBusy}
                      onClick={() => void retryPaymentRecovery()}
                    >
                      {recoverBusy ? 'Проверяем оплату…' : 'Проверить оплату сессии'}
                    </Button>
                  ) : null}
                  <p className="text-center text-sm leading-relaxed text-white/55">
                    После оформления заказа мы с вами свяжемся в течение 15 минут.
                  </p>
                  <Button type="button" variant="sell" className={calmBtnClass} onClick={openSessionCheckout}>
                    Купить сессию - 5 490 ₽
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
          <div className="mx-auto w-full max-w-md results-prose space-y-5">
            {sessionPaid ? (
              <p className="text-lg font-semibold leading-relaxed text-emerald-200">
                {CONSULTATION_PAID_THANKS_TEXT}
              </p>
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
        <PaymentCheckoutSheet
          open={sessionCheckoutOpen}
          product="consultation"
          sessionId={latestResult.id}
          onClose={() => setSessionCheckoutOpen(false)}
          onPaid={markSessionPaid}
          onNotice={setPayNotice}
        />
      </>
    );
  }

  const reportFeatures = [
    'Расшифровка сильных и слабых зон',
    'Адресные рекомендации именно под ваш профиль',
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
                : `Получить расширенный отчёт — ${reportPriceRub} ₽`}
            </Button>
            <SupportFooter showDeveloperCredit={false} />
          </div>
        }
      >
        <div className="mx-auto w-full max-w-md results-prose space-y-5 pb-4">
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
      {reportCheckoutSheet}
    </>
  );
};
