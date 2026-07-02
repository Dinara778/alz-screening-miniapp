import { useEffect, useMemo, useState } from 'react';
import { FullReportContent } from '../components/FullReportContent';
import {
  fetchCabinetReport,
  requestMagicLink,
  useCabinetSession,
} from '../utils/cabinetApi';
import type { SessionResult } from '../types';

function sessionIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  return q.get('session')?.trim() || null;
}

export const CabinetReportPage = () => {
  const { accessToken, ready, configured } = useCabinetSession();
  const sessionId = useMemo(() => sessionIdFromUrl(), []);
  const [session, setSession] = useState<SessionResult | null>(null);
  const [error, setError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (!ready || !accessToken || !sessionId) return;
    void fetchCabinetReport(accessToken, sessionId)
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [ready, accessToken, sessionId]);

  const onRequestLink = async () => {
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setLoginBusy(true);
    setError('');
    setLoginMsg('');
    try {
      await requestMagicLink(trimmed);
      setLoginMsg('Ссылка для входа отправлена на ' + trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить ссылку');
    } finally {
      setLoginBusy(false);
    }
  };

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
        <div className="cabinet-card cabinet-card-narrow">
          <h1>Расширенный отчёт</h1>
          <p className="cabinet-muted">Войдите по email, чтобы открыть отчёт.</p>
          <input
            className="cabinet-input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <button type="button" className="cabinet-btn" disabled={loginBusy} onClick={() => void onRequestLink()}>
            {loginBusy ? 'Отправка…' : 'Получить ссылку для входа'}
          </button>
          {loginMsg ? <p className="cabinet-success">{loginMsg}</p> : null}
          {error ? <p className="cabinet-error">{error}</p> : null}
        </div>
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
