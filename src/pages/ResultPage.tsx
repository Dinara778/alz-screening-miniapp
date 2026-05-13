import { useState } from 'react';
import { Button } from '../components/Button';
import { DomainProfileCard } from '../components/DomainProfileCard';
import { Footer } from '../components/Footer';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { buildResultShareText, getShareTestLink, shareOrCopyResultText } from '../utils/shareResult';
import { openTelegramInvoiceForProduct, reportPaidStorageKey } from '../utils/telegramPayments';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, setStage } = useApp();
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [consultationBusy, setConsultationBusy] = useState(false);
  const [consultationNotice, setConsultationNotice] = useState<string | null>(null);
  if (!latestResult) return null;
  const a = buildCognitiveAnalytics(latestResult);

  const handleShare = async () => {
    setShareNotice(null);
    const link = getShareTestLink();
    const text = buildResultShareText(a.activePatternCount, a.index.value);
    try {
      const mode = await shareOrCopyResultText(text, link);
      if (mode === 'clipboard') {
        setShareNotice('Текст скопирован в буфер обмена — вставьте его в чат или соцсеть.');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setShareNotice('Не удалось открыть шаринг. Скопируйте текст вручную или откройте ссылку на тест.');
    }
  };

  const handlePayFullReport = async () => {
    if (!latestResult) return;
    setPayNotice(null);
    setPayBusy(true);
    try {
      const r = await openTelegramInvoiceForProduct('full_report', latestResult.id);
      if (r.status === 'paid') {
        localStorage.setItem(reportPaidStorageKey(latestResult.id), '1');
        setStage('full-report');
        return;
      }
      if (r.status === 'skipped') {
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram. Откройте мини-приложение из бота.',
          no_api_url: 'Не задан адрес сервера оплаты (VITE_TELEGRAM_PAYMENTS_URL). Подключите бэкенд счетов — без него полный отчёт недоступен.',
          no_init_data: 'Откройте мини-приложение из Telegram (из бота), затем повторите оплату.',
          no_open_invoice: 'Обновите Telegram или откройте мини-приложение в актуальной версии клиента.',
        };
        setPayNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        setPayNotice('Оплата отменена.');
        return;
      }
      if (r.status === 'failed') {
        setPayNotice(`Оплата не завершена (${r.detail}).`);
        return;
      }
      setPayNotice(r.message);
    } finally {
      setPayBusy(false);
    }
  };

  const handlePayConsultation = async () => {
    if (!latestResult) return;
    setConsultationNotice(null);
    setConsultationBusy(true);
    try {
      const r = await openTelegramInvoiceForProduct('consultation', latestResult.id);
      if (r.status === 'paid') {
        setConsultationNotice('Оплата прошла. Менеджер свяжется с вами для согласования времени разбора.');
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-brand dark:border-slate-600 dark:bg-slate-950">
        <div className="text-xs uppercase tracking-widest text-emerald-300/90">📊 Аналитика по метрикам</div>
        <h1 className="text-2xl font-bold mt-1">✨ Базовый когнитивный профиль</h1>
        <p className="text-sm text-slate-400 mt-2">
          Отчёт по одному прохождению замера. Не медицинская оценка и не диагноз.
        </p>
        {!a.validation.interpretationTrusted ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium">Ограниченная достоверность данных этого замера</p>
            {a.validation.warnings.length ? (
              <ul className="mt-2 list-disc pl-5 text-amber-900/90 space-y-1">
                {a.validation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-amber-900/90">Повторите тест при полном прохождении всех блоков.</p>
            )}
          </div>
        ) : null}
      </div>

      <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900/40 dark:bg-slate-800/90">
        <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">📈 Индекс когнитивной устойчивости</div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="text-5xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{a.index.value}</span>
          <span className="text-slate-600 dark:text-slate-400 mb-1">/ 100</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600/80">
          <div className={`h-full ${a.index.barColorClass}`} style={{ width: `${a.index.value}%` }} />
        </div>
        <div className="mt-3">
          <div
            className={`inline-block rounded-lg border border-black/10 px-3 py-1 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 ${a.index.barColorClass}`}
          >
            {a.index.label}
          </div>
          <p className="mt-3 text-slate-700 leading-relaxed">{a.index.description}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-600 dark:bg-slate-800/90">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">🧩 Профиль доменов</h2>
        <div className="space-y-4">
          {a.domains.map((d) => (
            <DomainProfileCard key={d.key} domain={d} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-600 dark:bg-slate-800/90">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">🔗 Поделиться</h2>
        <p className="text-sm text-slate-600">
          Отправьте короткое описание профиля друзьям или сохраните ссылку на тест.
        </p>
        <Button variant="secondary" type="button" onClick={() => void handleShare()}>
          Поделиться результатом
        </Button>
        {shareNotice ? <p className="text-sm text-emerald-800">{shareNotice}</p> : null}
      </section>

      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-emerald-950 p-5 space-y-4 text-white shadow-brand-lg">
        <div className="text-xs uppercase tracking-widest text-emerald-300/90">📄 Полный анализ + рекомендации</div>
        <p className="text-slate-200 text-sm leading-relaxed">
          Расширенный отчёт:{' '}
          <strong className="font-bold text-white">персональная карта перегрузки</strong> (только в полной версии),{' '}
          <strong className="font-bold text-white">главные факторы влияния на концентрацию</strong> и{' '}
          <strong className="font-bold text-white">структурированный разбор по областям + рекомендации</strong> — в
          формате, удобном для самостоятельной работы с данными.
        </p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Краткие рекомендации (в полной версии)</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-emerald-50/95 space-y-1">
            {a.stabilizationTips.slice(0, 5).map((t) => (
              <li key={t.text}>{t.text}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            variant="sell"
            type="button"
            className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
            disabled={payBusy}
            onClick={() => void handlePayFullReport()}
          >
            {payBusy ? 'Открываем оплату…' : 'Получить полный анализ — 399 ₽'}
          </Button>
        </div>
        {payNotice ? <p className="text-sm text-amber-200">{payNotice}</p> : null}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm dark:border-emerald-800 dark:from-emerald-950/40 dark:to-slate-900">
        <h2 className="text-xl font-bold text-emerald-950 dark:text-emerald-100">🎓 Личный разбор когнитивного профиля</h2>
        <p className="text-slate-700 text-sm leading-relaxed">
          Если вы хотите глубже понять закономерности в своих ответах и получить персональный разбор результатов,
          можно пройти индивидуальный разбор с экспертом.
        </p>
        <p className="text-sm text-slate-600">Удалённо · 30–40 минут</p>
        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant="sell"
            type="button"
            className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold leading-snug sm:py-[1.125rem] sm:text-xl"
            disabled={consultationBusy}
            onClick={() => void handlePayConsultation()}
          >
            {consultationBusy ? 'Открываем оплату…' : 'Записаться на личный разбор — 5 490 ₽'}
          </Button>
        </div>
        {consultationNotice ? <p className="text-sm text-emerald-900">{consultationNotice}</p> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onRestart}>
          Пройти снова
        </Button>
      </div>
      <Footer />
    </div>
  );
};
