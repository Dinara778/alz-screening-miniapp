import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { CalmCardShell } from './CalmCardShell';
import { TELEGRAM_SUPPORT_URL } from './SupportFooter';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import { isStandaloneWeb } from '../utils/runtime';
import { openWebPayment, verifyWebReportPayment } from '../utils/webPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';
import {
  consultationPaidStorageKey,
  isReportPaidUnlocked,
  openTelegramInvoiceForProduct,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
  verifyReportPaymentOnServer,
  type TelegramInvoiceProduct,
} from '../utils/telegramPayments';

type Props = {
  open: boolean;
  product: TelegramInvoiceProduct;
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
  const reportPriceRub = PAYMENT_PRODUCTS.full_report.priceRub;
  const [payBusy, setPayBusy] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [alreadyPaidHelpOpen, setAlreadyPaidHelpOpen] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(() =>
    product === 'full_report' ? isReportPaidUnlocked(sessionId, false) : false,
  );
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
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
      setCheckBusy(false);
      payInFlightRef.current = false;
      return;
    }
    setAlreadyPaidHelpOpen(false);
    setPayBusy(false);
    setCheckBusy(false);
    setAwaitingReturn(false);
    setSheetNotice(null);
    payInFlightRef.current = false;
    if (product !== 'full_report') return;
    setAlreadyPaid(isReportPaidUnlocked(sessionId, serverPaymentsReady));
  }, [open, product, sessionId, serverPaymentsReady]);

  const tryConfirmConsultationPaid = useCallback(async (): Promise<boolean> => {
    if (product !== 'consultation') return false;
    const pending = sessionStorage.getItem(prodamusPendingOrderKey(sessionId));
    if (!pending) return false;
    const paid = await pollProdamusOrderPaidQuick(pending, sessionId);
    if (!paid) return false;
    localStorage.setItem(consultationPaidStorageKey(sessionId), '1');
    window.dispatchEvent(new Event('consultation-paid'));
    setAwaitingReturn(false);
    onPaid();
    onClose();
    return true;
  }, [product, sessionId, onPaid, onClose]);

  useEffect(() => {
    if (!open || product !== 'consultation') return;
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !awaitingReturn) return;
      void tryConfirmConsultationPaid();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, product, awaitingReturn, tryConfirmConsultationPaid]);

  useEffect(() => {
    if (!open || product !== 'full_report') return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
        onPaid(sessionId);
        onClose();
        return;
      }
      void verifyReportPaymentOnServer(sessionId).then((r) => {
        if (r.ok) {
          onPaid(r.sessionId);
          onClose();
        }
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, product, sessionId, serverPaymentsReady, onPaid, onClose]);

  if (!open) return null;

  const payLabel = payBusy
    ? 'Открываем оплату…'
    : awaitingReturn
      ? `Повторить оплату ${meta.priceRub} ₽`
      : `Оплатить ${meta.priceRub} ₽`;

  const handlePay = async () => {
    if (payBusy || payInFlightRef.current) return;
    if (product === 'full_report' && isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
      onPaid(sessionId);
      onClose();
      return;
    }
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      if (isStandaloneWeb()) {
        payInFlightRef.current = true;
        setPayBusy(true);
        showNotice(null);
        trackPaymentEvent('payment_click', { source: 'report_checkout', channel: 'web' });
        try {
          const r = await openWebPayment(product, sessionId);
          if (r.status === 'already_paid') {
            trackPaymentEvent('payment_paid', { channel: 'web' });
            onPaid(sessionId);
            onClose();
            return;
          }
          if (r.status === 'redirected') {
            trackPaymentEvent('payment_opened', { provider: 'robokassa', channel: 'web' });
            setAwaitingReturn(true);
            showNotice('Переход на страницу оплаты…');
            return;
          }
          if (r.status === 'pending_setup') {
            trackPaymentEvent('payment_error', { reason: 'robokassa_pending', channel: 'web' });
            showNotice(r.message);
            return;
          }
          trackPaymentEvent('payment_error', { reason: 'error', detail: r.message, channel: 'web' });
          showNotice(r.message);
        } finally {
          setPayBusy(false);
          payInFlightRef.current = false;
        }
        return;
      }
      showNotice('Откройте Corta из Telegram (кнопка у бота), не во внешнем браузере');
      return;
    }
    payInFlightRef.current = true;
    setPayBusy(true);
    setAwaitingReturn(false);
    showNotice(null);
    trackPaymentEvent('payment_click', { source: 'report_checkout' });
    try {
      tg.expand?.();
    } catch {
      /* ignore */
    }
    try {
      const r = await openTelegramInvoiceForProduct(product, sessionId);
      if (r.status === 'paid') {
        trackPaymentEvent('payment_paid');
        onPaid(sessionId);
        onClose();
        return;
      }
      if (r.status === 'redirected') {
        trackPaymentEvent('payment_opened', { provider: 'link' });
        setAwaitingReturn(true);
        showNotice(meta.redirectOpenedMessage);
        return;
      }
      if (r.status === 'skipped') {
        trackPaymentEvent('payment_error', { reason: r.reason });
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram',
          no_api_url: 'Сервер оплаты не настроен',
          no_init_data: 'Откройте приложение из бота Corta',
          no_open_invoice: 'Обновите Telegram до последней версии',
          no_open_link: 'Обновите Telegram до последней версии',
          payments_disabled:
            'Оплата не настроена на сервере. В Amvera: PAYMENT_PROVIDER=telegram, TELEGRAM_PAYMENT_PROVIDER_TOKEN, пересборка с VITE_PAYMENTS_ENABLED=true',
        };
        showNotice(byReason[r.reason] ?? 'Оплата временно недоступна');
        return;
      }
      if (r.status === 'cancelled') {
        trackPaymentEvent('payment_cancelled');
        showNotice('Оплата отменена. Нажмите «Оплатить» ещё раз, когда будете готовы.');
        return;
      }
      if (r.status === 'failed') {
        trackPaymentEvent('payment_error', { reason: 'failed', detail: r.detail });
        showNotice(
          r.detail === 'invoice_timeout'
            ? 'Окно оплаты закрылось. Нажмите «Оплатить» ещё раз.'
            : product === 'full_report'
              ? 'Оплата не завершена. Попробуйте ещё раз или напишите в техподдержку.'
              : 'Оплата не завершена. Попробуйте ещё раз.',
        );
        return;
      }
      if (r.status === 'error') {
        trackPaymentEvent('payment_error', { reason: 'error', detail: r.message });
        showNotice(r.message);
      }
    } finally {
      setPayBusy(false);
      payInFlightRef.current = false;
    }
  };

  const handleAlreadyPaidHelp = () => {
    if (product !== 'full_report' || payBusy) return;
    showNotice(null);
    setAlreadyPaidHelpOpen(true);
  };

  const handleCheckPayment = async () => {
    if (product !== 'full_report' || payBusy || checkBusy) return;
    setCheckBusy(true);
    showNotice('Проверяем оплату на сервере…');
    trackPaymentEvent('payment_recover_click');
    try {
      const r = isStandaloneWeb()
        ? await verifyWebReportPayment(sessionId)
        : await verifyReportPaymentOnServer(sessionId);
      if (r.ok) {
        trackPaymentEvent('payment_recover_paid', { paidSessionId: r.sessionId });
        onPaid(r.sessionId);
        onClose();
        return;
      }
      trackPaymentEvent('payment_recover_not_found');
      showNotice(r.message);
    } catch {
      trackPaymentEvent('payment_recover_error');
      showNotice('Не удалось связаться с сервером. Проверьте интернет и повторите.');
    } finally {
      setCheckBusy(false);
    }
  };

  const reportAlreadyPaidHelp = alreadyPaidHelpOpen && product === 'full_report';

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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">Оплата</p>
              <h2 id="payment-checkout-title" className="app-heading mt-1 leading-snug">
                {reportAlreadyPaidHelp
                  ? 'я уже оплатил(а)'
                  : alreadyPaid && product === 'full_report'
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
            <div className="mt-4 space-y-4">
              <p className="calm-body text-sm leading-relaxed text-white/90">
                Если вы оплатили {reportPriceRub} руб. за один расширенный отчёт, а он вам не открылся,
                пожалуйста, напишите нам в{' '}
                <a
                  href={TELEGRAM_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-300 underline underline-offset-2"
                >
                  Техподдержку Corta в Telegram
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
              <p className="text-xs leading-relaxed text-white/55">
                Одна сессия оценки когнитивного профиля стоит {reportPriceRub} руб. Это разовый платёж за
                расширенный отчёт, не подписка.
              </p>
              <Button
                type="button"
                variant="sell"
                disabled={checkBusy}
                className="relative z-20 w-full touch-manipulation rounded-2xl py-3.5 text-sm font-semibold"
                onClick={() => void handleCheckPayment()}
              >
                {checkBusy ? 'Проверяем оплату…' : 'Проверить оплату и открыть отчёт'}
              </Button>
              {sheetNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/95">{sheetNotice}</p>
              ) : null}
            </div>
          ) : alreadyPaid && product === 'full_report' ? (
            <div className="mt-4 space-y-4">
              <p className="calm-body text-sm text-emerald-100/95">
                Оплата учтена. Откройте расширенный отчёт.
              </p>
              <Button
                type="button"
                variant="sell"
                className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold sm:text-lg"
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
                  {meta.awaitingReturnHint}
                </p>
              ) : null}

              {sheetNotice ? (
                <p className="text-center text-xs leading-relaxed text-amber-200/90">{sheetNotice}</p>
              ) : null}
            </div>
          )}
        </div>

        {reportAlreadyPaidHelp ? (
          <div className="shrink-0 border-t border-white/10 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="secondary"
              className="w-full shrink-0 rounded-2xl py-3.5 text-sm font-semibold"
              onClick={() => setAlreadyPaidHelpOpen(false)}
            >
              Назад
            </Button>
          </div>
        ) : !alreadyPaid || product !== 'full_report' ? (
          <div className="relative z-20 shrink-0 space-y-3 border-t border-white/10 px-5 py-4 sm:px-6">
            {sheetNotice ? (
              <p className="text-center text-xs leading-relaxed text-amber-200/95">{sheetNotice}</p>
            ) : null}
            <Button
              type="button"
              variant="sell"
              disabled={payBusy}
              className="relative z-20 w-full shrink-0 touch-manipulation rounded-2xl py-4 text-[1.0625rem] font-bold sm:text-lg"
              onClick={() => void handlePay()}
              onPointerDown={(e) => {
                if (payBusy || payInFlightRef.current) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
            >
              {payLabel}
            </Button>

            {product === 'full_report' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={payBusy}
                className="relative z-20 w-full shrink-0 touch-manipulation rounded-2xl py-3.5 text-sm font-semibold"
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
