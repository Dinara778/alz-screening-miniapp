import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { SupportContactSheet } from './SupportContactSheet';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import { openWebPayment, pollRobokassaPaymentStatus } from '../utils/webPayments';
import type { CabinetPayment } from '../utils/cabinetApi';

const PRODUCT = 'expert_program_7d' as const;
const meta = PAYMENT_PRODUCTS[PRODUCT];

type Step = 'closed' | 'offer' | 'pay';

type Props = {
  email: string | null | undefined;
  payments: CabinetPayment[];
  fallbackSessionId?: string | null;
  onPurchased: () => void;
};

function expertProgramSessionId(email: string, fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim().slice(0, 80);
  const slug = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
  return `expert7d_${slug || 'user'}`.slice(0, 80);
}

export function hasExpertProgramPurchase(payments: CabinetPayment[]): boolean {
  return (payments ?? []).some(
    (p) => p.product === PRODUCT && String(p.type || '') !== 'refunded',
  );
}

export const CabinetExpertProgramOffer = ({
  email,
  payments,
  fallbackSessionId = null,
  onPurchased,
}: Props) => {
  const [step, setStep] = useState<Step>('closed');
  const [payBusy, setPayBusy] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [payerEmail, setPayerEmail] = useState('');

  const purchased = useMemo(() => hasExpertProgramPurchase(payments), [payments]);
  const sessionId = useMemo(
    () => expertProgramSessionId(email || payerEmail || '', fallbackSessionId),
    [email, payerEmail, fallbackSessionId],
  );

  useEffect(() => {
    if (step === 'pay') {
      setPayerEmail((prev) => prev.trim() || email?.trim().toLowerCase() || '');
    }
  }, [step, email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('robokassa') !== 'success') return;
    if (q.get('product') && q.get('product') !== PRODUCT) return;

    let cancelled = false;
    void (async () => {
      const polled = await pollRobokassaPaymentStatus(sessionId, PRODUCT, email || undefined);
      if (cancelled) return;
      if (polled) {
        setNotice('Оплата прошла. Программа отмечена в кабинете — эксперт свяжется с вами по email.');
        onPurchased();
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('robokassa');
        url.searchParams.delete('sessionId');
        url.searchParams.delete('product');
        url.searchParams.delete('OutSum');
        url.searchParams.delete('InvId');
        url.searchParams.delete('SignatureValue');
        for (const key of [...url.searchParams.keys()]) {
          if (key.startsWith('Shp_')) url.searchParams.delete(key);
        }
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, email, onPurchased]);

  useEffect(() => {
    if (!awaitingReturn || purchased) return;
    let cancelled = false;
    const check = async () => {
      const polled = await pollRobokassaPaymentStatus(sessionId, PRODUCT, email || undefined);
      if (cancelled || !polled) return;
      setAwaitingReturn(false);
      setStep('closed');
      setNotice('Оплата прошла. Программа отмечена в кабинете — эксперт свяжется с вами по email.');
      onPurchased();
    };
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [awaitingReturn, purchased, sessionId, email, onPurchased]);

  const handlePay = async () => {
    if (payBusy) return;
    const payer = payerEmail.trim().toLowerCase();
    if (!payer.includes('@') || payer.length > 254) {
      setNotice('Укажите корректный email — на него уйдёт чек и свяжется эксперт.');
      return;
    }
    setPayBusy(true);
    setNotice(null);
    try {
      const r = await openWebPayment(PRODUCT, sessionId, payer);
      if (r.status === 'already_paid') {
        setStep('closed');
        setNotice('Программа уже оформлена. Эксперт свяжется с вами по email.');
        onPurchased();
        return;
      }
      if (r.status === 'redirected') {
        setAwaitingReturn(true);
        setNotice('Переход на оплату… После оплаты вы вернётесь в кабинет.');
        return;
      }
      if (r.status === 'pending_setup') {
        setNotice(r.message);
        return;
      }
      setNotice(r.message);
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <>
      <section className="cabinet-card cabinet-expert-offer" style={{ marginTop: 16 }}>
        {purchased ? (
          <>
            <h2>Программа с экспертом</h2>
            <p className="cabinet-big">🧠 7-дневная программа оформлена</p>
            <p className="cabinet-muted" style={{ marginTop: 8 }}>
              Эксперт свяжется с вами по email {email || 'из профиля'} после оплаты.
            </p>
            {notice ? <p className="cabinet-success">{notice}</p> : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="cabinet-expert-cta"
              onClick={() => {
                setNotice(null);
                setStep('offer');
              }}
            >
              <span className="cabinet-expert-cta-emoji" aria-hidden>
                🧠
              </span>
              <span className="cabinet-expert-cta-body">
                <strong className="cabinet-expert-cta-title">
                  7-дневная программа восстановления когнитивной эффективности с экспертом
                </strong>
                <span className="cabinet-expert-cta-price">
                  {meta.priceRub.toLocaleString('ru-RU')} ₽
                </span>
              </span>
            </button>
            {notice ? <p className="cabinet-success" style={{ marginTop: 10 }}>{notice}</p> : null}
          </>
        )}
      </section>

      {step !== 'closed' ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expert-program-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Закрыть"
            onClick={() => setStep('closed')}
          />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1210] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl sm:px-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="expert-program-title" className="text-lg font-bold text-white">
                {step === 'offer' ? 'Программа с экспертом' : 'Оплата программы'}
              </h2>
              <button
                type="button"
                onClick={() => setStep('closed')}
                className="shrink-0 rounded-full px-2 py-1 text-2xl leading-none text-white/50 hover:text-white"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {step === 'offer' ? (
              <div className="space-y-4">
                <p className="text-base leading-relaxed text-white/85">
                  За 7 дней онлайн-общения с экспертом по когнитивной устойчивости вы определите,
                  какие факторы влияют на ваше состояние, какие изменения действительно улучшат
                  ваши показатели, и получите персональную стратегию поддержания высокой
                  когнитивной формы.
                </p>
                <p className="cabinet-expert-sheet-price">
                  {meta.priceRub.toLocaleString('ru-RU')} ₽
                </p>
                <Button
                  type="button"
                  className={CTA_BUTTON_CLASS}
                  onClick={() => setStep('pay')}
                >
                  Пройти программу
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-white/70">
                  Эксперт свяжется с вами по указанной при оплате почте после оплаты. На этот же
                  email Робокасса отправит чек.
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-white/60">Email для связи и чека</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    className="calm-input w-full"
                    placeholder="you@email.com"
                  />
                </label>
                {notice ? <p className="text-sm text-amber-200/95">{notice}</p> : null}
                <Button
                  type="button"
                  className={CTA_BUTTON_CLASS}
                  disabled={payBusy}
                  onClick={() => void handlePay()}
                >
                  {payBusy
                    ? 'Открываем оплату…'
                    : awaitingReturn
                      ? `Повторить оплату ${meta.priceRub.toLocaleString('ru-RU')} ₽`
                      : `Оплатить ${meta.priceRub.toLocaleString('ru-RU')} ₽`}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-teal-300/90 underline decoration-teal-400/40 underline-offset-2"
                  onClick={() => setSupportOpen(true)}
                >
                  Техподдержка
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <SupportContactSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialEmail={email}
        sessionId={sessionId}
        screen="cabinet/expert-program"
      />
    </>
  );
};
