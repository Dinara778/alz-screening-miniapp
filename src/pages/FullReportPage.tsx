import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { downloadCognitiveReportPdf } from '../utils/pdfReport';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

const REPORT_EMAIL_PREFIX = 'corta_report_email_';

const sellingCtaClass =
  'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30';

export const FullReportPage = () => {
  const { latestResult, participant, setStage } = useApp();
  const [step, setStep] = useState(0);
  const [reportEmail, setReportEmail] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
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
        Нет данных сессии. Вернитесь на главный экран.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setStage('welcome')}>
            На главную
          </Button>
        </div>
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
    try {
      await downloadCognitiveReportPdf(
        pdfRef.current,
        `cognitive-report-${latestResult.id.slice(0, 8)}.pdf`,
      );
    } finally {
      setPdfBusy(false);
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
        <div className="text-sm text-slate-600 mt-1">Персональный cognitive analytics report</div>
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
        информации в рамках одной сессии замера.
      </p>

      <h2 className="text-lg font-bold mb-2">2. Расшифровка доменов</h2>
      <ul className="mb-4 space-y-2">
        {analytics.domains.map((d) => (
          <li key={d.key}>
            <span className="font-semibold">{d.title}</span> — {d.score}/100. {d.shortDescription}
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
        <li>weekly cognitive tracking</li>
        <li>персональные cognitive insights</li>
        <li>углублённый разбор когнитивных паттернов</li>
      </ul>

      <div className="border border-slate-300 rounded-lg p-4 mt-6 bg-slate-50">
        <div className="font-bold text-slate-900">Личный разбор когнитивного профиля</div>
        <p className="mt-2 text-slate-800">
          Индивидуальный cognitive review онлайн, 30–40 минут. Стоимость: 5490 ₽. На сайте: «Записаться
          на разбор».
        </p>
      </div>

      {reportEmail.trim() ? (
        <p className="mt-4 text-sm text-slate-600">Email для отправки расширенного отчёта: {reportEmail.trim()}</p>
      ) : null}
    </div>
  );

  const screens = [
    {
      title: 'Ваш когнитивный профиль',
      body: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Ниже — агрегированный индекс по метрикам сессии. Это не диагноз, а поведенческий снимок
            устойчивости внимания и обработки информации.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-600">Индекс когнитивной устойчивости</div>
            <div className="text-5xl font-bold text-slate-900">{analytics.index.value}</div>
            <div className="mt-2 h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full ${analytics.index.barColorClass}`}
                style={{ width: `${analytics.index.value}%` }}
              />
            </div>
            <div className="mt-3 font-semibold text-slate-900">{analytics.index.label}</div>
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
          <ul className="space-y-3">
            {analytics.domains.map((d) => (
              <li key={d.key} className="rounded-lg border border-slate-200 p-3 bg-white">
                <div className="font-semibold">{d.title}</div>
                <div className="mt-1 h-2 rounded bg-slate-200">
                  <div className="h-2 rounded bg-emerald-800" style={{ width: `${d.score}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{d.shortDescription}</p>
                <p className="mt-1 text-xs text-slate-500">
                  В повседневности это проявляется как качество удержания фокуса и ровность темпа в длинных
                  блоках внимания.
                </p>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      title: 'Персональная карта перегрузки',
      body: (
        <div className="space-y-3">
          {analytics.overloadMap.map((o) => (
            <div
              key={o.id}
              className={`rounded-xl border p-4 ${o.active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="font-semibold">{o.title}</div>
              <div className="text-sm text-slate-700 mt-1">{o.explanation}</div>
              <div className="text-sm text-slate-600 mt-2">Как проявляется: {o.lifeManifestation}</div>
            </div>
          ))}
        </div>
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
      title: 'Что поможет стабилизировать когнитивную устойчивость',
      body: (
        <div className="space-y-2">
          <p className="text-slate-700 text-sm">
            Короткие персональные микро-действия без программ и тренировок — только то, что следует из ваших
            метрик.
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

  const hiddenPdfLayer = <div className="pointer-events-none fixed left-[-12000px] top-0 w-[210mm]">{pdfMarkup}</div>;

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
          Мы подготовим для вас персональный расширенный cognitive report с подробной расшифровкой
          результатов и отправим его на вашу почту.
        </p>
        <form className="space-y-3" onSubmit={handleEmailSubmit}>
          <input
            className="w-full rounded-xl border border-slate-300 p-3"
            type="email"
            required
            placeholder="Email"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" onClick={() => setStep(4)}>
              Назад
            </Button>
            <Button type="submit">Сохранить и перейти к PDF</Button>
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
        PDF формируется в браузере из тех же данных, что и экранный отчёт. В MVP отправка письма будет
        подключена на сервере; адрес уже сохранён для интеграции.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pdfBusy} onClick={handlePdf}>
          {pdfBusy ? 'Формирование…' : 'Скачать PDF'}
        </Button>
        <Button variant="secondary" type="button" onClick={() => setStage('welcome')}>
          Завершить
        </Button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-5 space-y-3">
        <h2 className="text-xl font-semibold text-emerald-950">Личный разбор когнитивного профиля</h2>
        <p className="text-slate-700">
          Если вы хотите глубже понять свои когнитивные паттерны и получить персональную интерпретацию
          результатов, можно пройти индивидуальный cognitive review.
        </p>
        <p className="text-sm text-slate-600">Формат: онлайн, 30–40 минут, персональный разбор результатов.</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="font-semibold text-slate-900">5490 ₽</span>
          <Button className={sellingCtaClass} type="button">
            Записаться на разбор
          </Button>
        </div>
      </div>

    </div>
    {hiddenPdfLayer}
    </>
  );
};
