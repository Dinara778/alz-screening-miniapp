import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getPaidReportSessionId } from '../utils/telegramPayments';
import { loadSessionFromHistory } from '../utils/storage';

/** На экране отчёта подставляет сессию, за которую реально оплачено (не на result — там показываем текущий тест). */
export function useSyncPaidReportSession() {
  const { latestResult, setLatestResult, stage } = useApp();

  useEffect(() => {
    if (stage !== 'full-report') return;
    const paidId = getPaidReportSessionId(latestResult?.id);
    if (!paidId || paidId === latestResult?.id) return;
    const session = loadSessionFromHistory(paidId);
    if (session) setLatestResult(session);
  }, [stage, latestResult?.id, setLatestResult]);
}
