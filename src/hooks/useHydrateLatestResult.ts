import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  loadLastSessionId,
  loadProgress,
  loadSessionFromHistory,
} from '../utils/storage';

/** Восстанавливает latestResult из history после перезагрузки WebView. */
export function useHydrateLatestResult() {
  const { latestResult, setLatestResult, stage } = useApp();

  useEffect(() => {
    if (latestResult) return;
    if (stage !== 'result' && stage !== 'full-report') return;

    const prog = loadProgress();
    const sid = prog?.latestSessionId ?? loadLastSessionId();
    const session = loadSessionFromHistory(sid);
    if (session) setLatestResult(session);
  }, [latestResult, setLatestResult, stage]);
}
