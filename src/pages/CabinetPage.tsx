import { useEffect, useState } from 'react';
import {
  cabinetReportUrl,
  fetchCabinetData,
  requestMagicLink,
  signOutCabinet,
  useCabinetSession,
  type CabinetAssessment,
  type CabinetData,
  type CabinetPayment,
} from '../utils/cabinetApi';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}

function paymentLabel(p: CabinetPayment): string {
  if (p.product === 'full_report') return 'Расширенный отчёт';
  if (p.product === 'consultation') return 'Сессия с экспертом';
  if (p.type === 'subscription') return 'Подписка';
  return 'Оплата';
}

function HistoryList({ rows, emptyText }: { rows: CabinetAssessment[]; emptyText: string }) {
  if (!rows.length) {
    return <p className="cabinet-muted">{emptyText}</p>;
  }
  return (
    <ul className="cabinet-history">
      {rows.map((row) => (
        <li key={row.sessionId} className="cabinet-history-row">
          <div className="cabinet-history-main">
            <span>{fmtDate(row.createdAt)}</span>
            <strong>{row.score}</strong>
          </div>
          <div className="cabinet-history-actions">
            {row.canOpenReport ? (
              <a className="cabinet-link-btn" href={cabinetReportUrl(row.sessionId)}>
                Открыть отчёт
              </a>
            ) : row.hasReportData ? (
              <span className="cabinet-muted cabinet-history-hint">Нужна оплата отчёта</span>
            ) : (
              <span className="cabinet-muted cabinet-history-hint">Отчёт не сохранён</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export const CabinetPage = () => {
  const { accessToken, email, ready, configured } = useCabinetSession();
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

  if (!ready || configured === null) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <p className="cabinet-muted">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (configured === false) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <h1>Личный кабинет</h1>
          <p className="cabinet-muted">
            Кабинет пока не настроен: добавьте SUPABASE_ANON_KEY на Amvera (этап «Запуск») или
            VITE_SUPABASE_* на «Сборка».
          </p>
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
            Войдите по email — пришлём ссылку без пароля. Используйте тот же адрес, что указывали при оценке.
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
            <a href="/">← Вернуться к оценке</a>
          </p>
        </div>
      </div>
    );
  }

  const latest = data?.latest;
  const history7d = data?.history7d ?? data?.history ?? [];
  const historyAll = data?.historyAll ?? history7d;
  const olderThan7d = historyAll.filter(
    (row) => !history7d.some((r) => r.sessionId === row.sessionId),
  );

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
                {latest.canOpenReport ? (
                  <p className="cabinet-foot" style={{ marginTop: 12 }}>
                    <a className="cabinet-link-btn" href={cabinetReportUrl(latest.sessionId)}>
                      Открыть расширенный отчёт
                    </a>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="cabinet-muted">Пока нет завершённых оценок. Пройдите оценку на главной.</p>
            )}
          </section>
        </div>

        <section className="cabinet-card" style={{ marginTop: 16 }}>
          <h2>Ваше упражнение</h2>
          {data?.compensationTip ? (
            <p className="cabinet-tip">{data.compensationTip}</p>
          ) : (
            <p className="cabinet-muted">Появится после следующего прохождения оценки.</p>
          )}
        </section>

        <section className="cabinet-card" style={{ marginTop: 16 }}>
          <h2>
            За последние 7 дней
            {history7d.length ? (
              <span className="cabinet-count">{history7d.length}</span>
            ) : null}
          </h2>
          <HistoryList rows={history7d} emptyText="Нет оценок за последние 7 дней." />
        </section>

        {olderThan7d.length > 0 ? (
          <section className="cabinet-card" style={{ marginTop: 16 }}>
            <h2>
              Ранее
              <span className="cabinet-count">{olderThan7d.length}</span>
            </h2>
            <HistoryList rows={olderThan7d} emptyText="Нет более ранних оценок." />
          </section>
        ) : null}

        <section className="cabinet-card" style={{ marginTop: 16 }}>
          <h2>Оплаты</h2>
          {data?.payments?.length ? (
            <ul className="cabinet-payments">
              {data.payments.map((p, i) => (
                <li key={`${p.createdAt}-${p.externalId ?? i}`}>
                  <div>
                    <strong>{paymentLabel(p)}</strong>
                    <span className="cabinet-muted cabinet-payment-date">{fmtDate(p.createdAt)}</span>
                  </div>
                  <span className="cabinet-payment-amount">{fmtRub(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cabinet-muted">Пока нет оплаченных заказов.</p>
          )}
        </section>

        <p className="cabinet-foot">
          <a href="/">Пройти оценку снова</a>
        </p>
      </div>
    </div>
  );
};
