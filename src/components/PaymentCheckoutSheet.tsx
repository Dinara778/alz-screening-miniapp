import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { CalmCardShell } from './CalmCardShell';
import { TELEGRAM_SUPPORT_URL } from './SupportFooter';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import { isReportUnlockProduct } from '../utils/paymentProductTypes';
import { openWebPayment, pollRobokassaPaymentStatus } from '../utils/webPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import { REPORT_TARIFF_PAYMENT_BUTTON_CLASS } from '../constants/ctaButton';
import type { ReportUnlockProduct } from '../utils/paymentProductTypes';
import {
  isReportPaidUnlocked,
  verifyReportPaymentOnServer,
} from '../utils/telegramPayments';

type Props = {
  open: boolean;
  product: ReportUnlockProduct;
  sessionId: string;
  onClose: () => void;
  /** sessionId оплаченного прохождения (для отчёта; может отличаться от текущего). */
  onPaid: (paidSessionId?: string) => void;
  onNotice: (message: string | null) => void;
};

export const PaymentCheckoutSheet = ({
  open,
  product,
  sessionId,
  onClose,
  onPaid,
  onNotice,
}: Props) => {
  const { serverPaymentsReady, participant } = useApp();
  const meta = PAYMENT_PRODUCTS[product];
  const [payBusy, setPayBusy] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [paymentOpenedInSameTab, setPaymentOpenedInSameTab] = useState(false);
  const [alreadyPaidHelpOpen, setAlreadyPaidHelpOpen] = useState(false);
  const [alreadyPaidHelpAcknowledged, setAlreadyPaidHelpAcknowledged] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(() =>
    isReportUnlockProduct(product) ? isReportPaidUnlocked(sessionId, false) : false,
  );
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const payInFlightRef = useRef(false);

  const showNotice = useCallback(
    (msg: string | null) => {
      setSheetNotice(msg);
      onNotice(msg);
    },
    [onNotice],
  );

  const trackPaymentEvent = useCallback(
    (eventType: string, extra?: Record<string, unknown>) => {
      void sendAnalyticsEventToSheets({
        eventType,
        sessionId,
        stage: 'result',
        screen: 'result/report-offer',
        participant: participant ?? undefined,
        product,
        ...extra,
      }).catch(() => {
        /* analytics must not break payment UX */
      });
    },
    [sessionId, participant, product],
  );

  useEffect(() => {
    if (!open) {
      setPayBusy(false);
      payInFlightRef.current = false;
      return;
    }
    setAlreadyPaidHelpOpen(false);
    setAlreadyPaidHelpAcknowledged(false);
    setPayBusy(false);
    setAwaitingReturn(false);
    setPaymentOpenedInSameTab(false);
    setSheetNotice(null);
    payInFlightRef.current = false;
    if (!isReportUnlockProduct(product)) return;
    setAlreadyPaid(isReportPaidUnlocked(sessionId, serverPaymentsReady));
  }, [open, product, sessionId, serverPaymentsReady]);

  const payerEmail = participant?.email?.trim();

  useEffect(() => {
    if (!open || !awaitingReturn || !isReportUnlockProduct(product)) return;
    let cancelled = false;
    const check = async () => {
      if (cancelled) return;
      if (isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
        onPaid(sessionId);
        onClose();
        return;
      }
      const polled = await pollRobokassaPaymentStatus(sessionId, product, payerEmail);
      if (cancelled || !polled) return;
      onPaid(polled.sessionId);
      onClose();
    };
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    open,
    awaitingReturn,
    product,
    sessionId,
    serverPaymentsReady,
    payerEmail,
    onPaid,
    onClose,
  ]);

  useEffect(() => {
    if (!open || !isReportUnlockProduct(product)) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
        onPaid(sessionId);
        onClose();
        return;
      }
      void verifyReportPaymentOnServer(sessionId, payerEmail).then((r) => {
        if (r.ok) {
          onPaid(r.sessionId);
          onClose();
        }
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, product, sessionId, serverPaymentsReady, onPaid, onClose, payerEmail]);

  if (!open) return null;

  const payLabel = payBusy
    ? 'Открываем оплату…'
    : awaitingReturn
      ? `Повторить оплату ${meta.priceRub} ₽`
      : `Оплатить ${meta.priceRub} ₽`;

  const handlePay = async () => {
    if (payBusy || payInFlightRef.current) return;
    if (isReportUnlockProduct(product) && isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
      onPaid(sessionId);
      onClose();
      return;
    }
    if (!payerEmail?.includes('@')) {
      showNotice('Для оплаты нужен email из анкеты. Вернитесь и укажите почту.');
      return;
    }

    payInFlightRef.current = true;
    setPayBusy(true);
    setAwaitingReturn(false);
    showNotice(null);
    trackPaymentEvent('payment_click', { source: 'report_checkout', channel: 'robokassa' });

    try {
      window.Telegram?.WebApp?.expand?.();
    } catch {
      /* ignore */
    }

    try {
      const r = await openWebPayment(product, sessionId, payerEmail);
      if (r.status === 'already_paid') {
        trackPaymentEvent('payment_paid', { channel: 'robokassa' });
        onPaid(sessionId);
        onClose();
        return;
      }
      if (r.status === 'redirected') {
        trackPaymentEvent('payment_opened', { provider: 'robokassa', channel: 'robokassa' });
        setAwaitingReturn(true);
        setPaymentOpenedInSameTab(r.sameTab);
        showNotice(
          r.sameTab
            ? 'После оплаты нажмите «Вернуться в магазин» на странице Робокассы.'
            : 'Оплата открыта в новой вкладке. Отчёт откроется здесь автоматически после оплаты.',
        );
        return;
      }
      if (r.status === 'pending_setup') {
        trackPaymentEvent('payment_error', { reason: 'robokassa_pending', channel: 'robokassa' });
        showNotice(r.message);
        return;
      }
      trackPaymentEvent('payment_error', { reason: 'error', detail: r.message, channel: 'robokassa' });
      showNotice(r.message);
    } finally {
      setPayBusy(false);
      payInFlightRef.current = false;
    }
  };

  const handleAlreadyPaidHelp = () => {
    if (!isReportUnlockProduct(product) || payBusy) return;
    showNotice(null);
    setAlreadyPaidHelpAcknowledged(false);
    setAlreadyPaidHelpOpen(true);
  };

  const reportAlreadyPaidHelp = alreadyPaidHelpOpen && isReportUnlockProduct(product);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-checkout-title"
    >
      <button
        type="button"
        aria-label="Закрыть окно оплаты"
        className="absolute inset-0 pointer-events-auto bg-black/70"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
      <CalmCardShell
        className="flex max-h-[min(92dvh,720px)] w-full flex-col rounded-b-none sm:rounded-3xl"
        innerClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 ${
            reportAlreadyPaidHelp ? 'pb-2 pt-4' : 'pb-3 pt-5 sm:pt-6'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`font-medium uppercase tracking-wide text-emerald-300/90 ${
                  reportAlreadyPaidHelp ? 'text-[10px]' : 'text-xs'
                }`}
              >
                Оплата
              </p>
              <h2
                id="payment-checkout-title"
                className={
                  reportAlreadyPaidHelp
                    ? 'mt-0.5 text-base font-bold leading-snug text-white/95 sm:text-lg'
                    : 'app-heading mt-1 leading-snug'
                }
              >
                {reportAlreadyPaidHelp
                  ? 'я уже оплатил(а)'
                  : alreadyPaid && isReportUnlockProduct(product)
                    ? 'Доступ уже есть'
                    : meta.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-1 text-2xl leading-none text-white/50 hover:text-white"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          {reportAlreadyPaidHelp ? (
            <div className="mt-2.5 space-y-2">
              <p className="text-xs leading-snug text-white/85">
                {meta.alreadyPaidHelpMain}{' '}
                <a
                  href={TELEGRAM_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-300 underline underline-offset-2"
                >
                  Техподдержку Corta daily в Telegram
                </a>{' '}
                или по почте{' '}
                <a
                  href="mailto:hello@bookvolon.ru"
                  className="font-medium text-teal-300 underline underline-offset-2"
                >
                  hello@bookvolon.ru
                </a>
                .
              </p>
              <p className="text-[11px] leading-snug text-white/50">{meta.alreadyPaidHelpNote}</p>
            </div>
          ) : alreadyPaid && isReportUnlockProduct(product) ? (
            <div className="mt-4 space-y-4">
              <p className="calm-body text-sm text-emerald-100/95">
                Оплата учтена. Откройте расширенный отчёт.
              </p>
              <Button
                type="button"
                variant="sell"
                className={REPORT_TARIFF_PAYMENT_BUTTON_CLASS}
                onClick={() => {
                  onPaid(sessionId);
                  onClose();
                }}
              >
                Открыть расширенный отчёт
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {meta.subtitle ? (
                <p className="calm-body text-sm text-white/80">{meta.subtitle}</p>
              ) : null}

              <ul className="calm-inset space-y-2 text-sm text-white/85">
                {meta.bullets.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {awaitingReturn ? (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-100/95">
                  {paymentOpenedInSameTab
                    ? 'После успешной оплаты нажмите «Вернуться в магазин» — отчёт откроется автоматически.'
                    : meta.awaitingReturnHint}
                </p>
              ) : null}

              {sheetNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/90">{sheetNotice}</p>
              ) : null}
            </div>
          )}
        </div>

        {reportAlreadyPaidHelp ? (
          <div className="shrink-0 space-y-2.5 border-t border-white/10 px-5 py-3 sm:px-6 sm:py-4">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-500"
                checked={alreadyPaidHelpAcknowledged}
                onChange={(e) => setAlreadyPaidHelpAcknowledged(e.target.checked)}
              />
              <span className="text-sm text-white/90">Я понял/а</span>
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={!alreadyPaidHelpAcknowledged}
              className="report-tariff-cta mt-0 w-full shrink-0 py-3 text-sm font-semibold disabled:opacity-50"
              onClick={() => {
                setAlreadyPaidHelpOpen(false);
                setAlreadyPaidHelpAcknowledged(false);
              }}
            >
              Назад
            </Button>
          </div>
        ) : !alreadyPaid || !isReportUnlockProduct(product) ? (
          <div className="relative z-20 shrink-0 space-y-3 border-t border-white/10 px-5 py-4 sm:px-6">
            {sheetNotice ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/95">{sheetNotice}</p>
            ) : null}
            <Button
              type="button"
              variant="sell"
              disabled={payBusy}
              className={`relative z-20 shrink-0 touch-manipulation ${REPORT_TARIFF_PAYMENT_BUTTON_CLASS}`}
              onClick={() => void handlePay()}
              onPointerDown={(e) => {
                if (payBusy || payInFlightRef.current) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
            >
              {payLabel}
            </Button>

            {isReportUnlockProduct(product) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={payBusy}
                className="report-tariff-cta relative z-20 mt-0 w-full shrink-0 touch-manipulation py-3.5 text-sm font-semibold"
                onClick={handleAlreadyPaidHelp}
              >
                я уже оплатил(а)
              </Button>
            ) : null}

            <button
              type="button"
              className="w-full py-1 text-sm text-white/45 hover:text-white/70"
              onClick={onClose}
            >
              Назад
            </button>
          </div>
        ) : (
          <div className="shrink-0 px-5 pb-4 sm:px-6">
            <button
              type="button"
              className="w-full py-2 text-sm text-white/45 hover:text-white/70"
              onClick={onClose}
            >
              Назад
            </button>
          </div>
        )}
      </CalmCardShell>
      </div>
    </div>
  );
};
