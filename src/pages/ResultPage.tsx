import { useState } from 'react';
import { CalmScreen } from '../components/results/CalmScreen';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { ScoreRing } from '../components/results/ScoreRing';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { useApp } from '../context/AppContext';
import { buildCognitiveAnalytics, type DomainScore } from '../utils/cognitiveAnalytics';
import { buildResultShareText, getShareTestLink, shareOrCopyResultText } from '../utils/shareResult';
import { isPaymentsStubbed, PAYMENT_STUB_MESSAGE } from '../utils/paymentStub';
import { openTelegramInvoiceForProduct, reportPaidStorageKey } from '../utils/telegramPayments';

type ResultStep = 'index' | 'domain' | 'hub';

const calmBtn =
  'w-full rounded-full border border-white/20 bg-white py-4 text-[1rem] font-semibold tracking-tight text-[#0a0c0b] transition hover:bg-white/95 active:scale-[0.99]';
const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

export const ResultPage = ({ onRestart }: { onRestart: () => void }) => {
  const { latestResult, setStage, setConsultationReturnTo } = useApp();
  const [step, setStep] = useState<ResultStep>('index');
  const [domainIndex, setDomainIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  if (!latestResult) return null;
  const a = buildCognitiveAnalytics(latestResult);
  const domains = a.domains;
  const currentDomain: DomainScore | undefined = domains[domainIndex];
  const accent = scoreAccentFromValue(a.index.value);
  const skipNativePayment = import.meta.env.VITE_DEV_BYPASS_REPORT_PAYMENT === 'true';

  const handleShare = async () => {
    setShareNotice(null);
    const link = getShareTestLink();
    const text = buildResultShareText(a.activePatternCount, a.index.value);
    try {
      const mode = await shareOrCopyResultText(text, link);
      if (mode === 'clipboard') {
        setShareNotice('Скопировано в буфер обмена');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setShareNotice('Не удалось поделиться');
    }
  };

  const handlePayFullReport = async () => {
    if (!latestResult) return;
    if (isPaymentsStubbed()) {
      setPayNotice(PAYMENT_STUB_MESSAGE);
      return;
    }
    if (skipNativePayment) {
      localStorage.setItem(reportPaidStorageKey(latestResult.id), '1');
      setStage('full-report');
      return;
    }
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
          not_telegram: 'Оплата только в Telegram',
          no_api_url: 'Сервер оплаты не настроен',
          no_init_data: 'Откройте из бота в Telegram',
          no_open_invoice: 'Обновите Telegram',
          no_open_link: 'Обновите Telegram',
        };
        setPayNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        setPayNotice('Оплата отменена');
        return;
      }
      if (r.status === 'failed') {
        setPayNotice(r.detail === 'prodamus_timeout' ? 'Ждём подтверждение оплаты…' : `Оплата не завершена`);
        return;
      }
      setPayNotice(r.message);
    } finally {
      setPayBusy(false);
    }
  };

  const handlePayConsultation = () => {
    if (isPaymentsStubbed()) {
      setPayNotice(PAYMENT_STUB_MESSAGE);
      return;
    }
    setConsultationReturnTo('result');
    setStage('consultation-request');
  };

  const startDomains = () => {
    setDomainIndex(0);
    setStep('domain');
  };

  const nextDomain = () => {
    if (domainIndex < domains.length - 1) {
      setDomainIndex((i) => i + 1);
    } else {
      setStep('hub');
    }
  };

  if (step === 'index') {
    return (
      <CalmScreen
        kicker="Когнитивный профиль"
        footer={
          <>
            {!a.validation.interpretationTrusted ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/90">
                Ограниченная достоверность замера — пройдите все блоки заново для точного профиля.
              </p>
            ) : null}
            <button type="button" className={calmBtn} onClick={startDomains}>
              Узнать расшифровку
            </button>
          </>
        }
      >
        <OrganicMetricHalo accent={accent}>
          <span className="text-[clamp(3.5rem,16vw,5rem)] font-semibold tabular-nums leading-none tracking-tight text-white">
            {a.index.value}
          </span>
          <span className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">из 100</span>
        </OrganicMetricHalo>
        <p className="mt-10 max-w-[18rem] text-center text-sm font-medium leading-relaxed text-white/70">
          {a.index.label}
        </p>
        <p className="mt-3 max-w-[20rem] text-center text-xs leading-relaxed text-white/40">
          Индекс когнитивной устойчивости по вашему прохождению. Не диагноз.
        </p>
      </CalmScreen>
    );
  }

  if (step === 'domain' && currentDomain) {
    const d = currentDomain;
    const dAccent = scoreAccentFromValue(d.score);
    return (
      <CalmScreen
        kicker={`${domainIndex + 1} / ${domains.length}`}
        footer={
          <button type="button" className={calmBtn} onClick={nextDomain}>
            {domainIndex < domains.length - 1 ? 'Далее' : 'Готово'}
          </button>
        }
      >
        <p className="mb-8 max-w-[16rem] text-center text-sm font-medium text-white/55">{d.title}</p>
        <div className="relative flex h-[min(62vw,260px)] w-[min(62vw,260px)] items-center justify-center">
          <ScoreRing value={d.score} accent={dAccent} size={260} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[clamp(3rem,14vw,4.25rem)] font-semibold tabular-nums leading-none text-white">
              {d.score}
            </span>
          </div>
        </div>
        <p className="mt-10 max-w-[20rem] text-center text-sm leading-relaxed text-white/65">
          {d.interpretation.aboutResult}
        </p>
      </CalmScreen>
    );
  }

  return (
    <CalmScreen
      kicker="Дальше"
      footer={
        <div className="space-y-3">
          <button type="button" className={calmBtn} disabled={payBusy} onClick={() => void handlePayFullReport()}>
            {payBusy ? 'Открываем оплату…' : 'Расширенный отчёт — 399 ₽'}
          </button>
          <button type="button" className={calmBtnGhost} onClick={() => void handleShare()}>
            Поделиться
          </button>
          <button type="button" className={calmBtnGhost} onClick={handlePayConsultation}>
            Сессия с экспертом
          </button>
          <button type="button" className={`${calmBtnGhost} !text-white/50`} onClick={onRestart}>
            Пройти снова
          </button>
          {shareNotice ? <p className="text-center text-xs text-white/50">{shareNotice}</p> : null}
          {payNotice ? <p className="text-center text-xs text-amber-200/90">{payNotice}</p> : null}
        </div>
      }
    >
      <p className="max-w-[18rem] text-center text-lg font-medium leading-snug text-white/80">
        Подробная карта перегрузки и рекомендации — в расширенном отчёте
      </p>
    </CalmScreen>
  );
};
