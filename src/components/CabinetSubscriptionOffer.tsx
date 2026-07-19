import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { SupportContactSheet } from './SupportContactSheet';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import { openWebPayment, pollRobokassaPaymentStatus } from '../utils/webPayments';

const PRODUCT = 'subscription_1m' as const;
const meta = PAYMENT_PRODUCTS[PRODUCT];

type Props = {
  email: string | null | undefined;
  fallbackSessionId?: string | null;
  onPurchased: () => void;
};

function subscriptionSessionId(email: string, fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim().slice(0, 80);
  const slug = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
  return `sub1m_${slug || 'user'}`.slice(0, 80);
}

export const CabinetSubscriptionOffer = ({
  email,
  fallbackSessionId = null,
  onPurchased,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [payerEmail, setPayerEmail] = useState('');

  const sessionId = useMemo(
    () => subscriptionSessionId(email || payerEmail || '', fallbackSessionId),
    [email, payerEmail, fallbackSessionId],
  );

  useEffect(() => {
    if (open) {
      setPayerEmail((prev) => prev.trim() || email?.trim().toLowerCase() || '');
    }
  }, [open, email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('robokassa') !== 'success') return;
    if (q.get('product') !== PRODUCT) return;

    let cancelled = false;
    void (async () => {
      const polled = await pollRobokassaPaymentStatus(sessionId, PRODUCT, email || undefined);
      if (cancelled) return;
      if (polled) {
        setNotice('Подписка активирована.');
        onPurchased();
      }
      try {
        const url = new URL(window.location.href);
        ['robokassa', 'sessionId', 'product', 'OutSum', 'InvId', 'SignatureValue'].forEach((k) =>
          url.searchParams.delete(k),
        );
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
    if (!awaitingReturn) return;
    let cancelled = false;
    const check = async () => {
      const polled = await pollRobokassaPaymentStatus(sessionId, PRODUCT, email || undefined);
      if (cancelled || !polled) return;
      setAwaitingReturn(false);
      setOpen(false);
      setNotice('Подписка активирована.');
      onPurchased();
    };
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [awaitingReturn, sessionId, email, onPurchased]);

  const handlePay = async () => {
    if (payBusy) return;
    const payer = payerEmail.trim().toLowerCase();
    if (!payer.includes('@') || payer.length > 254) {
      setNotice('Укажите корректный email — на него уйдёт чек.');
      return;
    }
    setPayBusy(true);
    setNotice(null);
    try {
      const r = await openWebPayment(PRODUCT, sessionId, payer);
      if (r.status === 'already_paid') {
        setOpen(false);
        setNotice('Подписка уже активна.');
        onPurchased();
        return;
      }
      if (r.status === 'redirected') {
        setAwaitingReturn(true);
        setNotice(
          'Переход на оплату… После оплаты вы вернётесь в кабинет. Если этого не произошло — нажмите «Вернуться в магазин» на странице Робокассы.',
        );
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
      <section className="cabinet-card cabinet-sub-offer" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="cabinet-sub-cta"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
        >
          <span className="cabinet-sub-cta-emoji" aria-hidden>
            ⭐
          </span>
          <span className="cabinet-sub-cta-body">
            <strong className="cabinet-sub-cta-title">
              Подписка Corta daily — полные отчёты и динамика день за днём
            </strong>
            <span className="cabinet-sub-cta-price">
              {meta.priceRub.toLocaleString('ru-RU')} ₽/мес
            </span>
          </span>
        </button>
        {notice ? <p className="cabinet-success" style={{ marginTop: 10 }}>{notice}</p> : null}
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cabinet-sub-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1210] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl sm:px-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="cabinet-sub-title" className="text-lg font-bold text-white">
                Подписка Corta daily
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full px-2 py-1 text-2xl leading-none text-white/50 hover:text-white"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-base leading-relaxed text-white/85">
                Сравнение изменений день за днём, полные отчёты после каждой оценки и практика для
                восстановления.
              </p>
              <p className="cabinet-expert-sheet-price">
                {meta.priceRub.toLocaleString('ru-RU')} ₽
                <span className="text-base font-semibold text-white/55"> / мес</span>
              </p>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-white/60">Email для чека</span>
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
          </div>
        </div>
      ) : null}

      <SupportContactSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialEmail={email}
        sessionId={sessionId}
        screen="cabinet/subscription"
      />
    </>
  );
};
