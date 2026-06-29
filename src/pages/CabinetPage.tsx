import { useEffect, useState } from 'react';
import {
  fetchCabinetData,
  requestMagicLink,
  signOutCabinet,
  useCabinetSession,
  type CabinetData,
} from '../utils/cabinetApi';
import { isSupabaseBrowserConfigured } from '../utils/supabaseBrowser';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const CabinetPage = () => {
  const { accessToken, email, ready } = useCabinetSession();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [data, setData] = useState<CabinetData | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!ready || !accessToken) return;
    void fetchCabinetData(accessToken)
      .then(setData)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [ready, accessToken]);

  const onRequestLink = async () => {
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setLoginError('Введите корректный email');
      return;
    }
    setLoginBusy(true);
    setLoginError('');
    setLoginMsg('');
    try {
      await requestMagicLink(trimmed);
      setLoginMsg('Ссылка для входа отправлена на ' + trimmed + '. Проверьте почту.');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Не удалось отправить ссылку');
    } finally {
      setLoginBusy(false);
    }
  };

  const onLogout = async () => {
    await signOutCabinet();
    setData(null);
    window.location.href = '/cabinet';
  };

  if (!isSupabaseBrowserConfigured()) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <h1>Личный кабинет</h1>
          <p className="cabinet-muted">Кабинет пока не настроен на сервере (нужны VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY).</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <p className="cabinet-muted">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card cabinet-card-narrow">
          <h1>Личный кабинет Corta</h1>
          <p className="cabinet-muted">
            Войдите по email — пришлём ссылку без пароля. Используйте тот же адрес, что указывали при тесте.
          </p>
          <input
            className="cabinet-input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onRequestLink();
            }}
          />
          <button type="button" className="cabinet-btn" disabled={loginBusy} onClick={() => void onRequestLink()}>
            {loginBusy ? 'Отправка…' : 'Получить ссылку для входа'}
          </button>
          {loginMsg ? <p className="cabinet-success">{loginMsg}</p> : null}
          {loginError ? <p className="cabinet-error">{loginError}</p> : null}
          <p className="cabinet-foot">
            <a href="/">← Вернуться к тесту</a>
          </p>
        </div>
      </div>
    );
  }

  const latest = data?.latest;

  return (
    <div className="cabinet-shell">
      <div className="cabinet-wrap">
        <header className="cabinet-header">
          <div>
            <h1>Личный кабинет</h1>
            <p className="cabinet-muted">{email ?? data?.email}</p>
          </div>
          <button type="button" className="cabinet-btn-secondary" onClick={() => void onLogout()}>
            Выйти
          </button>
        </header>

        {loadError ? <p className="cabinet-error">{loadError}</p> : null}

        <div className="cabinet-grid">
          <section className="cabinet-card">
            <h2>Статус доступа</h2>
            <p className="cabinet-big">{data?.access.label ?? '—'}</p>
            {data?.access.endDate ? (
              <p className="cabinet-muted">до {data.access.endDate}</p>
            ) : null}
          </section>

          <section className="cabinet-card">
            <h2>Текущее состояние</h2>
            {latest ? (
              <>
                <p className="cabinet-score">{latest.score}</p>
                <p className="cabinet-muted">индекс когнитивной устойчивости</p>
                <ul className="cabinet-metrics">
                  <li><span>Память</span><strong>{latest.memoryScore}</strong></li>
                  <li><span>Внимание</span><strong>{latest.attentionScore}</strong></li>
                  <li><span>Скорость</span><strong>{latest.speedScore}</strong></li>
                  <li><span>Стабильность</span><strong>{latest.stabilityScore ?? '—'}</strong></li>
                  <li><span>Гибкость</span><strong>{latest.flexibilityScore ?? '—'}</strong></li>
                </ul>
              </>
            ) : (
              <p className="cabinet-muted">Пока нет завершённых оценок. Пройдите тест на главной.</p>
            )}
          </section>
        </div>

        <section className="cabinet-card" style={{ marginTop: 16 }}>
          <h2>Ваше упражнение</h2>
          {data?.compensationTip ? (
            <p className="cabinet-tip">{data.compensationTip}</p>
          ) : (
            <p className="cabinet-muted">Появится после следующего прохождения теста.</p>
          )}
        </section>

        <section className="cabinet-card" style={{ marginTop: 16 }}>
          <h2>История за 7 дней</h2>
          {data?.history?.length ? (
            <ul className="cabinet-history">
              {data.history.map((row) => (
                <li key={row.sessionId}>
                  <span>{fmtDate(row.createdAt)}</span>
                  <strong>{row.score}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cabinet-muted">Нет оценок за последние 7 дней.</p>
          )}
        </section>

        <p className="cabinet-foot">
          <a href="/">Пройти тест снова</a>
        </p>
      </div>
    </div>
  );
};
