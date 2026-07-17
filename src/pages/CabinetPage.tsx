import { useEffect, useState } from 'react';
import { CabinetChangeSection } from '../components/CabinetChangeSection';
import { CabinetLoginForm } from '../components/CabinetLoginForm';
import {
  cabinetReportUrl,
  cancelCabinetSubscription,
  fetchCabinetData,
  signOutCabinet,
  useCabinetSession,
  type CabinetAssessment,
  type CabinetData,
  type CabinetPayment,
} from '../utils/cabinetApi';
import { setSubscriptionFromServer, clearSubscriptionAccess } from '../utils/subscriptionAccess';

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
  if (p.product === 'full_report') return 'Разовый разбор';
  if (p.product === 'subscription_1m') return 'Подписка Corta daily — 1 месяц';
  if (p.product === 'subscription_3m') return 'Подписка «Corta daily» — 3 месяца';
  if (p.product === 'consultation') return 'Сессия с экспертом';
  if (p.type === 'subscription') return 'Подписка Corta daily';
  return 'Оплата';
}

function fmtDateOnly(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
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
              <span className="cabinet-muted cabinet-history-hint">Отчёт недоступен</span>
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
  const { accessToken, email, ready, configured, refresh } = useCabinetSession();
  const [data, setData] = useState<CabinetData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

  useEffect(() => {
    if (!ready || !accessToken) return;
    void fetchCabinetData(accessToken)
      .then((cabinet) => {
        setData(cabinet);
        if (cabinet.subscription?.endDate) {
          setSubscriptionFromServer(cabinet.subscription.endDate);
        } else {
          clearSubscriptionAccess();
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [ready, accessToken]);

  const onLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLoadError('');
    try {
      await signOutCabinet();
      clearSubscriptionAccess();
      setData(null);
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось выйти');
    } finally {
      setLogoutBusy(false);
    }
  };

  const onCancelSubscription = async () => {
    if (!accessToken || cancelBusy) return;
    setCancelBusy(true);
    setCancelMsg('');
    setLoadError('');
    try {
      const result = await cancelCabinetSubscription(accessToken);
      const refreshed = await fetchCabinetData(accessToken);
      setData(refreshed);
      setCancelMsg(
        result.endDate
          ? `Подписка отменена. Доступ сохранится до ${fmtDateOnly(result.endDate)}.`
          : 'Подписка отменена.',
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось отменить подписку');
    } finally {
      setCancelBusy(false);
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

  if (configured === false) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-card">
          <h1>Личный кабинет</h1>
          <p className="cabinet-muted">
            Кабинет не настроен: на Amvera укажите <strong>anon public</strong> ключ из Supabase → API
            в <code>VITE_SUPABASE_ANON_KEY</code> (сборка) и <code>SUPABASE_ANON_KEY</code> (запуск).
            Не подставляйте <code>service_role</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="cabinet-shell">
        <CabinetLoginForm onLoggedIn={refresh} />
        <p className="cabinet-foot" style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/">← Вернуться к оценке</a>
        </p>
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
          <button
            type="button"
            className="cabinet-btn-secondary"
            disabled={logoutBusy}
            onClick={() => void onLogout()}
          >
            {logoutBusy ? 'Выход…' : 'Выйти'}
          </button>
        </header>

        {loadError ? <p className="cabinet-error">{loadError}</p> : null}

        <div className="cabinet-grid">
          <section className="cabinet-card">
            <h2>Подписка</h2>
            {data?.subscription ? (
              <>
                <p className="cabinet-big">{data.subscription.planLabel}</p>
                <p className="cabinet-muted">действует до {fmtDateOnly(data.subscription.endDate)}</p>
                {data.subscription.status === 'cancelled' ? (
                  <p className="cabinet-muted">Автопродление отключено</p>
                ) : null}
                {data.subscription.canCancel ? (
                  <button
                    type="button"
                    className="cabinet-btn-secondary"
                    style={{ marginTop: 12 }}
                    disabled={cancelBusy}
                    onClick={() => void onCancelSubscription()}
                  >
                    {cancelBusy ? 'Отмена…' : 'Отменить подписку'}
                  </button>
                ) : null}
                {cancelMsg ? <p className="cabinet-success">{cancelMsg}</p> : null}
              </>
            ) : data?.access.type === 'one_time' ? (
              <p className="cabinet-muted">У вас разовый доступ к отчёту без подписки.</p>
            ) : (
              <p className="cabinet-muted">Активной подписки нет.</p>
            )}
          </section>

          <section className="cabinet-card">
            <h2>Статус доступа</h2>
            <p className="cabinet-big">{data?.access.label ?? '—'}</p>
            {data?.access.endDate ? (
              <p className="cabinet-muted">до {fmtDateOnly(data.access.endDate)}</p>
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

        <CabinetChangeSection historySortedDesc={historyAll} />

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
          <a href="/?retake=1">Пройти оценку снова</a>
        </p>
      </div>
    </div>
  );
};
