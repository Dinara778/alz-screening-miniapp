import { useEffect } from 'react';
import { Button } from '../components/Button';
import { FullReportContent } from '../components/FullReportContent';
import { useApp } from '../context/AppContext';
import { useHydrateLatestResult } from '../hooks/useHydrateLatestResult';
import { useSyncPaidReportSession } from '../hooks/useSyncPaidReportSession';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import { isReportPaidUnlocked, isPaymentsBackendConfigured } from '../utils/telegramPayments';

export const FullReportPage = () => {
  const {
    latestResult,
    participant,
    setStage,
    openResultAtStep,
    serverPaymentsReady,
    setAnalyticsScreenDetail,
  } = useApp();
  useHydrateLatestResult();
  useSyncPaidReportSession();

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

  return (
    <FullReportContent
      session={latestResult}
      onDone={() => openResultAtStep('complete')}
      doneButtonLabel="Далее"
      onAnalyticsDetail={setAnalyticsScreenDetail}
    />
  );
};
