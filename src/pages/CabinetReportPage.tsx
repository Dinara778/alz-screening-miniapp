import { useEffect, useMemo, useState } from 'react';
import { CabinetLoginForm } from '../components/CabinetLoginForm';
import { FullReportContent } from '../components/FullReportContent';
import { fetchCabinetReport, useCabinetSession } from '../utils/cabinetApi';
import type { SessionResult } from '../types';

function sessionIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  return q.get('session')?.trim() || null;
}

export const CabinetReportPage = () => {
  const { accessToken, ready, configured, refresh } = useCabinetSession();
  const sessionId = useMemo(() => sessionIdFromUrl(), []);
  const [session, setSession] = useState<SessionResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !accessToken || !sessionId) return;
    void fetchCabinetReport(accessToken, sessionId)
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [ready, accessToken, sessionId]);

  if (!ready || configured === null) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <p className="cabinet-muted">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <p className="cabinet-error">Не указано прохождение.</p>
          <p className="cabinet-foot">
            <a href="/cabinet">← В кабинет</a>
          </p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="cabinet-shell">
        <CabinetLoginForm
          title="Расширенный отчёт"
          subtitle="Войдите по email и введите код из письма, чтобы открыть отчёт."
          onLoggedIn={() => void refresh()}
        />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <h1>Отчёт</h1>
          <p className="cabinet-error">{error}</p>
          <p className="cabinet-foot">
            <a href="/cabinet">← В кабинет</a>
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <p className="cabinet-muted">Загружаем отчёт…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-calm-shell mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 py-4 text-white">
      <p className="cabinet-foot mb-3">
        <a href="/cabinet">← В кабинет</a>
      </p>
      <div className="flex min-h-0 flex-1 flex-col">
        <FullReportContent
          session={session}
          onDone={() => {
            window.location.href = '/cabinet';
          }}
          doneButtonLabel="В кабинет"
        />
      </div>
    </div>
  );
};
