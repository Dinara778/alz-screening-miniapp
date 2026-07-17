import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { FullReportContent } from '../components/FullReportContent';
import { useApp } from '../context/AppContext';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { useSyncPaidReportSession } from '../hooks/useSyncPaidReportSession';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import {
  confirmReportAccessForSession,
  isPaymentsBackendConfigured,
} from '../utils/telegramPayments';
import { isSubscriptionActiveLocal } from '../utils/subscriptionAccess';
import { arePaymentsActive, isDevPaymentBypass } from '../utils/paymentStub';

export const FullReportPage = () => {
  const {
    latestResult,
    participant,
    setStage,
    openResultAtStep,
    restartApp,
    serverPaymentsReady,
    setAnalyticsScreenDetail,
  } = useApp();
  const payerEmail =
    latestResult?.participant?.email?.trim() || participant?.email?.trim() || '';
  const subscriptionActive = isSubscriptionActiveLocal(payerEmail);
  const [accessState, setAccessState] = useState<'checking' | 'granted' | 'denied'>('checking');
  useHydrateLatestResult();
  useSyncPaidReportSession();

  useEffect(() => {
    if (!latestResult?.id) return;
    if (isDevPaymentBypass() || !arePaymentsActive(serverPaymentsReady)) {
      setAccessState('granted');
      return;
    }

    let cancelled = false;
    setAccessState('checking');
    void confirmReportAccessForSession(latestResult.id, payerEmail, serverPaymentsReady).then(
      (confirmed) => {
        if (cancelled) return;
        setAccessState(confirmed ? 'granted' : 'denied');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [latestResult?.id, payerEmail, serverPaymentsReady]);

  useEffect(() => {
    if (!latestResult || accessState !== 'granted') return;
    if (!isPaymentsBackendConfigured(serverPaymentsReady)) return;
    void sendAnalyticsEventToSheets({
      eventType: 'full_report_opened',
      sessionId: latestResult.id,
      stage: 'full-report',
      participant: participant ?? undefined,
    }).catch(() => {});
  }, [latestResult, participant, serverPaymentsReady, accessState]);

  if (!latestResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-white">
        <p className="text-sm text-white/85">Загружаем отчёт…</p>
        <Button variant="secondary" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  if (accessState === 'checking') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white">
        <p className="text-sm text-white/85">Проверяем оплату…</p>
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-white">
        <p className="font-medium">Расширенный отчёт доступен только после оплаты.</p>
        <Button variant="secondary" type="button" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  return (
    <FullReportContent
      session={latestResult}
      onDone={() => openResultAtStep(subscriptionActive ? 'complete' : 'subscription-offer')}
      doneButtonLabel="Далее"
      onAnalyticsDetail={setAnalyticsScreenDetail}
      finishMode={
        subscriptionActive
          ? { cabinetHref: '/cabinet', onHome: restartApp }
          : undefined
      }
    />
  );
};
