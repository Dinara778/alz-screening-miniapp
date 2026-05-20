import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import { ResultOverloadMap } from '../components/ResultOverloadMap';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { useApp } from '../context/AppContext';
import { formatDomainInterpretationPlain } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { downloadCognitiveReportPdf } from '../utils/pdfReport';
import { isReportPaidUnlocked, isPaymentsBackendConfigured } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

const REPORT_EMAIL_PREFIX = 'corta_report_email_';

type ReportStep = 'report' | 'email' | 'pdf-sent' | 'learned' | 'upsell';

const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

const learnedItems = [
  'ваши зоны перегрузки',
  'скорость восстановления',
  'слабые когнитивные паттерны',
  'рекомендации по улучшению',
] as const;

const upsellFeatures = [
  'Расшифровку результатов простым языком',
  'Персональные рекомендации под вашу ситуацию',
  'Понимание, что больше всего мешает вашему ресурсу',
  'План улучшения показателей',
] as const;

export const FullReportPage = () => {
  const { latestResult, participant, setStage, setConsultationReturnTo } = useApp();
  const [step, setStep] = useState<ReportStep>('report');
  const [reportEmail, setReportEmail] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const analytics = useMemo(() => {
    if (!latestResult) return null;
    return buildCognitiveAnalytics(latestResult);
  }, [latestResult]);

  useEffect(() => {
    if (!latestResult) return;
    const saved = localStorage.getItem(`${REPORT_EMAIL_PREFIX}${latestResult.id}`);
    if (saved) setReportEmail(saved);
    else if (participant?.email) setReportEmail(participant.email);
  }, [latestResult?.id, participant?.email]);

  useEffect(() => {
    if (!latestResult) return;
    if (!isPaymentsBackendConfigured()) return;
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
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-white">
        Нет данных о прохождении.
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
      <div className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-white">
        <p className="font-medium">Расширенный отчёт доступен после оплаты.</p>
        <Button variant="secondary" type="button" onClick={() => setStage('result')}>
          К результатам
        </Button>
      </div>
    );
  }

  const accent = scoreAccentFromValue(analytics.index.value);

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
    setStep('pdf-sent');
  };

  const handlePdf = async () => {
    if (!pdfRef.current) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadCognitiveReportPdf(pdfRef.current, `otchet-${latestResult.id.slice(0, 8)}.pdf`);
    } catch (e) {
      console.error('[pdf]', e);
      setPdfError(
        'Не удалось сформировать PDF. Откройте мини-приложение через ⋯ → «Открыть в браузере» и повторите.',
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handleConsultation = () => {
    setConsultationReturnTo('full-report');
    setStage('consultation-request');
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU');

  const pdfMarkup = (
    <div
      ref={pdfRef}
      className="bg-white p-8 text-[13px] leading-relaxed text-slate-900"
      style={{ width: '190mm', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <h1 className="text-xl font-bold">Расширенный отчёт Corta</h1>
      <p className="mt-2 text-sm text-slate-600">
        {fmt(latestResult.date)} · Индекс {analytics.index.value}/100 · {analytics.index.label}
      </p>
      <p className="mt-3">{analytics.index.description}</p>
      <h2 className="mt-6 text-lg font-bold">Домены</h2>
      <ul className="mt-2 space-y-3">
        {analytics.domains.map((d) => (
          <li key={d.key}>
            <strong>
              {d.title} — {d.score}/100
            </strong>
            <div className="mt-1 whitespace-pre-line text-sm">{formatDomainInterpretationPlain(d.interpretation)}</div>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-bold">Карта перегрузки</h2>
      <ul className="mt-2 space-y-1">
        {analytics.overloadMap.map((o) => (
          <li key={o.id}>
            {o.title}: {o.active ? o.explanation : 'в пределах нормы'}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-bold">Рекомендации</h2>
      <ul className="mt-2 list-disc pl-5">
        {analytics.stabilizationTips.map((t) => (
          <li key={t.text}>{t.text}</li>
        ))}
      </ul>
    </div>
  );

  const hiddenPdfLayer = (
    <div className="pdf-export-root pointer-events-none fixed left-[-12000px] top-0 z-0 w-[210mm] max-w-[210mm]">
      {pdfMarkup}
    </div>
  );

  if (step === 'report') {
    return (
      <>
        <ReportFlowShell
          footer={
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => setStep('email')}>
              Получить PDF на почту
            </Button>
          }
        >
          <div className="mx-auto w-full max-w-md space-y-6">
            <SketchHighlightTitle accent={accent}>Ваш расширенный отчёт готов</SketchHighlightTitle>
            <p className="results-body">Ниже — расширенная расшифровка по вашему прохождению.</p>

            <div className="calm-inset space-y-3">
              <SketchHighlightTitle accent={accent}>Индекс когнитивной устойчивости</SketchHighlightTitle>
              <div className="text-4xl font-bold tabular-nums">{analytics.index.value}</div>
              <p className="results-body">{analytics.index.description}</p>
              {analytics.index.recommendations.length > 0 ? (
                <ul className="list-none space-y-2 text-sm leading-relaxed text-white/88 sm:text-base">
                  {analytics.index.recommendations.map((rec) => (
                    <li key={rec}>• {rec}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-3">
              <SketchHighlightTitle accent={accent}>Сильные и слабые зоны</SketchHighlightTitle>
              <div className="space-y-3">
                {analytics.domains.map((d) => (
                  <DomainProfileCard key={d.key} domain={d} />
                ))}
              </div>
            </div>

            <div>
              <SketchHighlightTitle accent={accent}>Карта когнитивной перегрузки</SketchHighlightTitle>
              <div className="mt-3">
                <ResultOverloadMap
                  overloadMap={analytics.overloadMap}
                  overloadMapIntro={analytics.index.overloadMapIntro}
                  overloadVisualTier={analytics.index.overloadVisualTier}
                />
              </div>
            </div>

            <div className="calm-inset space-y-3">
              <SketchHighlightTitle accent={accent}>Краткие рекомендации</SketchHighlightTitle>
              <ul className="list-none space-y-2 text-sm leading-relaxed text-white/88 sm:text-base">
                {analytics.stabilizationTips.map((t) => (
                  <li key={t.text}>• {t.text}</li>
                ))}
              </ul>
            </div>
          </div>
        </ReportFlowShell>
        {hiddenPdfLayer}
      </>
    );
  }

  if (step === 'email') {
    return (
      <>
        <ReportFlowShell
          footer={
            <Button type="submit" form="report-email-form" className={CTA_BUTTON_CLASS}>
              Отправить PDF на почту
            </Button>
          }
        >
          <div className="mx-auto w-full max-w-md space-y-5">
            <SketchHighlightTitle accent={accent}>PDF-отчёт на почту</SketchHighlightTitle>
            <p className="results-body">
              Укажите почту — мы отправим расширенный отчёт в PDF. Пока можно также скачать файл на устройство.
            </p>
            <form id="report-email-form" className="space-y-3" onSubmit={handleEmailSubmit}>
              <input
                className="calm-input"
                type="email"
                required
                placeholder="Электронная почта"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
              />
            </form>
            {pdfError ? <p className="text-sm text-amber-200/90">{pdfError}</p> : null}
            <Button type="button" variant="secondary" disabled={pdfBusy} onClick={() => void handlePdf()}>
              {pdfBusy ? 'Формирование…' : 'Скачать PDF на устройство'}
            </Button>
          </div>
        </ReportFlowShell>
        {hiddenPdfLayer}
      </>
    );
  }

  if (step === 'pdf-sent') {
    const email = reportEmail.trim();
    return (
      <ReportFlowShell
        footer={
          <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => setStep('learned')}>
            Далее
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-4 text-center sm:text-left">
          <SketchHighlightTitle accent={accent}>PDF отправлен на вашу почту</SketchHighlightTitle>
          <p className="results-body">
            {email ? (
              <>
                Отчёт отправлен на <span className="font-medium text-white">{email}</span>. Проверьте входящие и папку
                «Спам».
              </>
            ) : (
              'Адрес сохранён. Отправка письма подключится на сервере; PDF можно скачать на предыдущем шаге.'
            )}
          </p>
        </div>
      </ReportFlowShell>
    );
  }

  if (step === 'learned') {
    return (
      <ReportFlowShell
        footer={
          <Button type="button" className={CTA_BUTTON_CLASS} onClick={() => setStep('upsell')}>
            Далее
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-md space-y-5">
          <SketchHighlightTitle accent={accent}>Что вы узнали</SketchHighlightTitle>
          <ul className="calm-inset space-y-2.5 text-sm leading-relaxed text-white/88 sm:text-base">
            {learnedItems.map((item) => (
              <li key={item} className="flex gap-2 capitalize">
                <span className="text-emerald-400" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </ReportFlowShell>
    );
  }

  return (
    <ReportFlowShell
      footer={
        <div className="space-y-3">
          <Button type="button" variant="sell" className={CTA_BUTTON_CLASS} onClick={handleConsultation}>
            Записаться на сессию — 5 490 ₽
          </Button>
          <p className="text-center text-sm leading-relaxed text-white/55">
            После оформления заказа мы с вами свяжемся в течение 15 минут.
          </p>
          <button type="button" className={calmBtnGhost} onClick={() => setStage('welcome')}>
            На главную
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md space-y-5">
        <SketchHighlightTitle accent={accent}>Разобрать результаты с экспертом</SketchHighlightTitle>
        <p className="results-body">
          30-минутная сессия по вашему когнитивному профилю с экспертом по когнитивной устойчивости.
        </p>
        <div className="calm-inset space-y-3">
          <p className="text-sm font-semibold text-white/90 sm:text-base">Что вы получите:</p>
          <ul className="space-y-2.5 text-sm leading-relaxed text-white/88 sm:text-base">
            {upsellFeatures.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="shrink-0 text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ReportFlowShell>
  );
};
