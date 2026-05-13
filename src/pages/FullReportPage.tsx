import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import { ResultOverloadMap } from '../components/ResultOverloadMap';
import { useApp } from '../context/AppContext';
import { formatDomainInterpretationPlain } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { downloadCognitiveReportPdf } from '../utils/pdfReport';
import { openTelegramInvoiceForProduct, isReportPaidUnlocked } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

const REPORT_EMAIL_PREFIX = 'corta_report_email_';

export const FullReportPage = () => {
  const { latestResult, participant, setStage } = useApp();
  const [step, setStep] = useState(0);
  const [reportEmail, setReportEmail] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [consultationBusy, setConsultationBusy] = useState(false);
  const [consultationNotice, setConsultationNotice] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const analytics = useMemo(() => {
    if (!latestResult) return null;
    return buildCognitiveAnalytics(latestResult);
  }, [latestResult]);

  useEffect(() => {
    if (!latestResult) return;
    const saved = localStorage.getItem(`${REPORT_EMAIL_PREFIX}${latestResult.id}`);
    if (saved) setReportEmail(saved);
  }, [latestResult?.id]);

  useEffect(() => {
    if (!latestResult) return;
    if (import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true') return;
    if (!isReportPaidUnlocked(latestResult.id)) return;
    void sendAnalyticsEventToSheets({
      eventType: 'full_report_opened',
      sessionId: latestResult.id,
      stage: 'full-report',
      participant: participant ?? undefined,
    }).catch(() => {});
  }, [latestResult, participant]);

  if (!latestResult || !analytics) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
        Нет данных о прохождении. Вернитесь на главный экран.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setStage('welcome')}>
            На главную
          </Button>
        </div>
      </div>
    );
  }

  if (!isReportPaidUnlocked(latestResult.id)) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-slate-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50">
        <p className="font-medium">Полный отчёт доступен только после успешной оплаты.</p>
        <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
          Если оплата ещё не подключена, настройте сервер счетов и переменную{' '}
          <span className="font-mono text-xs">VITE_TELEGRAM_PAYMENTS_URL</span> в мини-приложении.
        </p>
        <Button variant="secondary" type="button" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  const persistEmail = (email: string) => {
    localStorage.setItem(`${REPORT_EMAIL_PREFIX}${latestResult.id}`, email);
    void sendAnalyticsEventToSheets({
      eventType: 'report_delivery_email',
      sessionId: latestResult.id,
      reportEmail: email,
      participant: participant ?? undefined,
    }).catch(() => {});
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reportEmail.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    persistEmail(trimmed);
    setStep(6);
  };

  const handlePdf = async () => {
    if (!pdfRef.current) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadCognitiveReportPdf(
        pdfRef.current,
        `otchet-${latestResult.id.slice(0, 8)}.pdf`,
      );
    } catch (e) {
      console.error('[pdf]', e);
      setPdfError(
        'Не удалось сохранить файл. Откройте мини-приложение через меню (⋯) → «Открыть в браузере» и повторите.',
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePayConsultation = async () => {
    if (!latestResult) return;
    setConsultationNotice(null);
    setConsultationBusy(true);
    try {
      const r = await openTelegramInvoiceForProduct('consultation', latestResult.id);
      if (r.status === 'paid') {
        setConsultationNotice('Оплата прошла. Менеджер свяжется с вами для согласования времени сессии.');
        return;
      }
      if (r.status === 'skipped') {
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram. Откройте мини-приложение из бота.',
          no_api_url: 'Не задан адрес сервера оплаты (VITE_TELEGRAM_PAYMENTS_URL).',
          no_init_data: 'Откройте мини-приложение из Telegram (из бота), затем повторите оплату.',
          no_open_invoice: 'Обновите Telegram или откройте мини-приложение в актуальной версии клиента.',
        };
        setConsultationNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        setConsultationNotice('Оплата отменена.');
        return;
      }
      if (r.status === 'failed') {
        setConsultationNotice(`Оплата не завершена (${r.detail}).`);
        return;
      }
      setConsultationNotice(r.message);
    } finally {
      setConsultationBusy(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU');

  const pdfMarkup = (
    <div
      ref={pdfRef}
      className="bg-white text-slate-900 p-8 text-[13px] leading-relaxed"
      style={{ width: '190mm', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <div className="text-2xl font-bold tracking-tight">Полный анализ когнитивной устойчивости</div>
        <div className="text-sm text-slate-600 mt-1">Персональный аналитический отчёт</div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>Дата: {fmt(latestResult.date)}</span>
          <span>Индекс: {analytics.index.value}/100</span>
          <span>{analytics.index.label}</span>
        </div>
        <p className="mt-3 text-slate-700">{analytics.index.description}</p>
      </div>

      <h2 className="text-lg font-bold mb-2">1. Общий когнитивный профиль</h2>
      <p className="mb-4 text-slate-800">
        Индекс когнитивной устойчивости отражает согласованность внимания, темпа реакции и удержания
        информации в рамках одного прохождения замера.
      </p>

      <h2 className="text-lg font-bold mb-2">2. Расшифровка доменов</h2>
      <ul className="mb-4 space-y-4 list-none pl-0">
        {analytics.domains.map((d) => (
          <li key={d.key}>
            <div className="font-semibold">
              {d.title} — {d.score}/100
            </div>
            <div className="mt-1 text-sm whitespace-pre-line leading-relaxed">
              {formatDomainInterpretationPlain(d.interpretation)}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-bold mb-2">3. Персональная карта перегрузки</h2>
      <ul className="mb-4 space-y-2">
        {analytics.overloadMap.map((o) => (
          <li key={o.id}>
            <span className="font-semibold">{o.title}</span>
            {o.active ? `: ${o.explanation}` : ': признаки в пределах допустимого для профиля'}
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-bold mb-2">4. Что влияет на устойчивость внимания</h2>
      <ul className="mb-4 list-disc pl-5">
        {analytics.concentrationDrivers.length ? (
          analytics.concentrationDrivers.map((c) => <li key={c.text}>{c.text}</li>)
        ) : (
          <li>Доминирующих факторов не выделено — профиль относительно ровный.</li>
        )}
      </ul>

      <h2 className="text-lg font-bold mb-2">5. Персональные рекомендации</h2>
      <ul className="mb-4 list-disc pl-5">
        {analytics.stabilizationTips.map((t) => (
          <li key={t.text}>{t.text}</li>
        ))}
      </ul>

      <h2 className="text-lg font-bold mb-2">6. Что можно исследовать глубже</h2>
      <p className="mb-4 text-slate-800">
        Текущий отчёт показывает общий профиль устойчивости внимания и обработки информации.
      </p>
      <p className="mb-4 text-slate-800">В следующих версиях будут доступны:</p>
      <ul className="mb-4 list-disc pl-5">
        <li>наблюдение за динамикой внимания</li>
        <li>отслеживание изменений состояния</li>
        <li>еженедельное отслеживание показателей внимания</li>
        <li>персональные выводы по динамике</li>
        <li>углублённый разбор закономерностей в ответах</li>
      </ul>

      <div className="border border-slate-300 rounded-lg p-4 mt-6 bg-slate-50">
        <div className="font-bold text-slate-900">Персональная сессия с экспертом</div>
        <p className="mt-2 text-slate-800">
          Персональная сессия удалённо, 30–40 минут. Стоимость: 5 490 ₽. На сайте: «Записаться на персональную сессию».
        </p>
      </div>

      {reportEmail.trim() ? (
        <p className="mt-4 text-sm text-slate-600">Электронная почта для отправки расширенного отчёта: {reportEmail.trim()}</p>
      ) : null}
    </div>
  );

  const screens = [
    {
      title: 'Ваш когнитивный профиль',
      body: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Ниже — сводный индекс по метрикам этого прохождения. Это не диагноз, а поведенческий снимок
            устойчивости внимания и обработки информации.
          </p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Индекс когнитивной устойчивости</div>
            <div className="text-5xl font-bold text-slate-900 dark:text-slate-100">{analytics.index.value}</div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600/80">
              <div className={`h-full ${analytics.index.barColorClass}`} style={{ width: `${analytics.index.value}%` }} />
            </div>
            <div
              className={`mt-3 inline-block rounded-lg border border-black/10 px-2.5 py-1 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 ${analytics.index.barColorClass}`}
            >
              {analytics.index.label}
            </div>
            <p className="mt-2 text-slate-700">{analytics.index.description}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Как сейчас работает внимание',
      body: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Пять доменов описывают разные стороны обработки: от устойчивости к отвлечению до удержания
            контекста после нагрузки.
          </p>
          <div className="space-y-3">
            {analytics.domains.map((d) => (
              <DomainProfileCard key={d.key} domain={d} />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Персональная карта перегрузки',
      body: (
        <ResultOverloadMap
          overloadMap={analytics.overloadMap}
          overloadMapIntro={analytics.index.overloadMapIntro}
          overloadVisualTier={analytics.index.overloadVisualTier}
        />
      ),
    },
    {
      title: 'Что сильнее всего влияет на вашу концентрацию',
      body: (
        <ul className="list-disc pl-5 space-y-2 text-slate-800">
          {analytics.concentrationDrivers.length ? (
            analytics.concentrationDrivers.map((c) => <li key={c.text}>{c.text}</li>)
          ) : (
            <li>Явных доминирующих факторов не выделено — распределение нагрузки относительно ровное.</li>
          )}
        </ul>
      ),
    },
    {
      title: 'Краткие рекомендации',
      body: (
        <div className="space-y-3">
          <p className="text-slate-700 text-sm leading-relaxed">
            Интерпретация по вашим метрикам: персональные шаги без «программ тренировок» — только то, что следует из
            профиля этого прохождения.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-800">
            {analytics.stabilizationTips.map((t) => (
              <li key={t.text}>{t.text}</li>
            ))}
          </ul>
        </div>
      ),
    },
  ];

  const hiddenPdfLayer = (
    <div className="pdf-export-root pointer-events-none fixed left-[-12000px] top-0 z-0 w-[210mm] max-w-[210mm]">
      {pdfMarkup}
    </div>
  );

  if (step <= 4) {
    const s = screens[step];
    return (
      <>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Полный отчёт · шаг {step + 1} из 5
          </div>
          <Button variant="secondary" type="button" onClick={() => setStage('result')}>
            Назад к профилю
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{s.title}</h1>
        {s.body}
        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button variant="secondary" type="button" onClick={() => setStep((x) => x - 1)}>
              Назад
            </Button>
          ) : null}
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((x) => x + 1)}>
              Далее
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep(5)}>
              Продолжить
            </Button>
          )}
        </div>
      </div>
      {hiddenPdfLayer}
      </>
    );
  }

  if (step === 5) {
    return (
      <>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Получение расширенного отчёта</h1>
        <p className="text-slate-700">
          Мы подготовим для вас персональный расширенный отчёт с подробной расшифровкой результатов и отправим его
          на вашу почту.
        </p>
        <form className="space-y-3" onSubmit={handleEmailSubmit}>
          <input
            className="w-full rounded-xl border border-slate-300 p-3"
            type="email"
            required
            placeholder="Электронная почта"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={() => setStep(4)}>
              Назад
            </Button>
            <Button type="submit">Сохранить и перейти к файлу отчёта</Button>
          </div>
        </form>
      </div>
      {hiddenPdfLayer}
      </>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Отчёт готов</h1>
      <p className="text-slate-700">
        Файл отчёта формируется в браузере из тех же данных, что и экранный отчёт. Отправка письма будет подключена
        на сервере позже; адрес уже сохранён для интеграции.
      </p>
      {pdfError ? <p className="text-sm text-amber-900">{pdfError}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pdfBusy} onClick={() => void handlePdf()}>
          {pdfBusy ? 'Формирование…' : 'Скачать отчёт'}
        </Button>
        <Button variant="secondary" type="button" onClick={() => setStage('welcome')}>
          Завершить
        </Button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-5 space-y-3">
        <h2 className="text-xl font-bold text-emerald-950">Персональная сессия с экспертом</h2>
        <p className="text-slate-700">
          Если вы хотите глубже понять закономерности в своих ответах и получить персональную интерпретацию
          результатов, можно пройти персональную сессию с экспертом.
        </p>
        <p className="text-sm text-slate-600">
          Формат: удалённо, 30–40 минут, разбор метрик в формате живой встречи.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-lg font-bold text-slate-900">5 490 ₽</span>
          <Button
            variant="sell"
            type="button"
            disabled={consultationBusy}
            onClick={() => void handlePayConsultation()}
          >
            {consultationBusy ? 'Открываем оплату…' : 'Записаться на персональную сессию — 5 490 ₽'}
          </Button>
        </div>
        {consultationNotice ? <p className="text-sm text-emerald-900">{consultationNotice}</p> : null}
      </div>

    </div>
    {hiddenPdfLayer}
    </>
  );
};
