import { useState } from 'react';
import { Button } from '../components/Button';
import { CalmScreen } from '../components/results/CalmScreen';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { OrganicMetricHalo } from '../components/results/OrganicMetricHalo';
import { ScoreRing } from '../components/results/ScoreRing';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { useApp } from '../context/AppContext';
import type { DomainInterpretationCopy } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics, type DomainScore } from '../utils/cognitiveAnalytics';
import type { IndexInterpretation } from '../utils/indexInterpretationBands';
import { buildResultShareText, getShareTestLink, shareOrCopyResultText } from '../utils/shareResult';
import { isPaymentsStubbed, PAYMENT_STUB_MESSAGE } from '../utils/paymentStub';
import { openTelegramInvoiceForProduct, reportPaidStorageKey } from '../utils/telegramPayments';

type ResultStep = 'index' | 'index-detail' | 'domain-metric' | 'domain-detail' | 'hub';

const calmBtnClass = CTA_BUTTON_CLASS;
const calmBtnGhost =
  'w-full rounded-full border border-white/15 bg-transparent py-3.5 text-[0.9375rem] font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5';

const DomainInterpretationBody = ({
  title,
  interpretation,
}: {
  title: string;
  interpretation: DomainInterpretationCopy;
}) => {
  const { inLife, manifestations, aboutResult } = interpretation;
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h2 className="app-heading text-center">{title}</h2>
      <div className="calm-inset space-y-4 results-body text-center">
        <p>
          <span className="block font-semibold text-white/95">В жизни</span>
          {inLife}
        </p>
        <p>
          <span className="block font-semibold text-white/95">Как проявляется</span>
          {manifestations}
        </p>
        <p>
          <span className="block font-semibold text-white/95">О чём говорит результат</span>
          {aboutResult}
        </p>
      </div>
    </div>
  );
};

/** «Прямо сейчас у вас …» — из подписи индекса (без дублирования заглавной). */
const indexStatusPhrase = (label: string) => {
  const rest = label.trim();
  if (!rest) return 'Прямо сейчас у вас заметная перегрузка внимания';
  return `Прямо сейчас у вас ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
};

const IndexInterpretationBody = ({ index }: { index: IndexInterpretation }) => (
  <div className="mx-auto w-full max-w-md space-y-4">
    <h2 className="app-heading text-center">{index.label}</h2>
    <div className="calm-inset space-y-5 results-body text-center">
      <p>{index.description}</p>
      {index.recommendations.length > 0 ? (
        <div>
          <p className="mb-3 font-semibold text-white/95">Рекомендации</p>
          <ul className="mx-auto max-w-sm list-none space-y-2.5">
            {index.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm text-white/55 sm:text-base">{index.overloadMapIntro}</p>
    </div>
  </div>
);

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
    setStep('domain-metric');
  };

  const nextFromDomainDetail = () => {
    if (domainIndex < domains.length - 1) {
      setDomainIndex((i) => i + 1);
      setStep('domain-metric');
    } else {
      setStep('hub');
    }
  };

  if (step === 'index') {
    return (
      <CalmScreen
        kicker="Ваш когнитивный профиль"
        kickerProfile
        footer={
          <>
            {!a.validation.interpretationTrusted ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/90">
                Ограниченная достоверность замера — пройдите все блоки заново для точного профиля.
              </p>
            ) : null}
            <Button type="button" className={calmBtnClass} onClick={() => setStep('index-detail')}>
              Узнать, что это значит
            </Button>
          </>
        }
      >
        <OrganicMetricHalo accent={accent} emphasis>
          <span className="text-[clamp(3.75rem,17vw,5.25rem)] font-semibold tabular-nums leading-none tracking-tight text-white">
            {a.index.value}
          </span>
          <span className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">из 100</span>
        </OrganicMetricHalo>
        <p className="mt-8 max-w-[min(22rem,92vw)] px-2 text-center text-lg font-semibold leading-snug text-white sm:mt-10 sm:text-xl">
          {indexStatusPhrase(a.index.label)}
        </p>
      </CalmScreen>
    );
  }

  if (step === 'index-detail') {
    return (
      <CalmScreen
        kicker="Индекс когнитивной устойчивости"
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={startDomains}>
            Далее — показатели профиля
          </Button>
        }
      >
        <IndexInterpretationBody index={a.index} />
      </CalmScreen>
    );
  }

  if (step === 'domain-metric' && currentDomain) {
    const d = currentDomain;
    const dAccent = scoreAccentFromValue(d.score);
    return (
      <CalmScreen
        kicker={`${domainIndex + 1} / ${domains.length}`}
        footer={
          <Button type="button" className={calmBtnClass} onClick={() => setStep('domain-detail')}>
            Узнать, что это значит
          </Button>
        }
      >
        <p className="mb-8 max-w-[18rem] text-center text-base font-medium text-white/70 sm:text-lg">{d.title}</p>
        <div className="relative flex h-[min(62vw,260px)] w-[min(62vw,260px)] items-center justify-center">
          <ScoreRing value={d.score} accent={dAccent} size={260} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[clamp(3rem,14vw,4.25rem)] font-semibold tabular-nums leading-none text-white">
              {d.score}
            </span>
          </div>
        </div>
      </CalmScreen>
    );
  }

  if (step === 'domain-detail' && currentDomain) {
    const d = currentDomain;
    return (
      <CalmScreen
        kicker={`${domainIndex + 1} / ${domains.length}`}
        contentAlign="readable"
        footer={
          <Button type="button" className={calmBtnClass} onClick={nextFromDomainDetail}>
            {domainIndex < domains.length - 1 ? 'Далее' : 'Готово'}
          </Button>
        }
      >
        <DomainInterpretationBody title={d.title} interpretation={d.interpretation} />
      </CalmScreen>
    );
  }

  return (
    <CalmScreen
      kicker="Дальше"
      footer={
        <div className="space-y-3">
          <Button type="button" className={calmBtnClass} disabled={payBusy} onClick={() => void handlePayFullReport()}>
            {payBusy ? 'Открываем оплату…' : 'Расширенный отчёт — 399 ₽'}
          </Button>
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
      <p className="max-w-[20rem] text-center text-xl font-medium leading-snug text-white/85 sm:text-2xl">
        Подробная карта перегрузки и рекомендации — в расширенном отчёте
      </p>
    </CalmScreen>
  );
};
