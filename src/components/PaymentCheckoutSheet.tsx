import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './Button';
import { CalmCardShell } from './CalmCardShell';
import { TELEGRAM_SUPPORT_URL } from './SupportFooter';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import {
  consultationPaidStorageKey,
  isReportPaidUnlocked,
  openTelegramInvoiceForProduct,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
  recoverFullReportAccess,
  type TelegramInvoiceProduct,
} from '../utils/telegramPayments';

type Props = {
  open: boolean;
  product: TelegramInvoiceProduct;
  sessionId: string;
  onClose: () => void;
  onPaid: () => void;
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
  const { serverPaymentsReady } = useApp();
  const meta = PAYMENT_PRODUCTS[product];
  const reportPriceRub = PAYMENT_PRODUCTS.full_report.priceRub;
  const [payBusy, setPayBusy] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [alreadyPaidHelpOpen, setAlreadyPaidHelpOpen] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(() =>
    product === 'full_report' ? isReportPaidUnlocked(sessionId, false) : false,
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

  useEffect(() => {
    if (!open) return;
    setAlreadyPaidHelpOpen(false);
    if (product !== 'full_report') return;
    setAlreadyPaid(isReportPaidUnlocked(sessionId, serverPaymentsReady));
    setAwaitingReturn(false);
    setSheetNotice(null);
    payInFlightRef.current = false;
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
        onPaid();
        onClose();
        return;
      }
      void recoverFullReportAccess(sessionId).then((r) => {
        if (r.ok) {
          onPaid();
          onClose();
        }
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, product, sessionId, serverPaymentsReady, onPaid, onClose]);

  if (!open) return null;

  const payBusyOnly = payBusy;

  const handlePay = async () => {
    if (payBusyOnly || payInFlightRef.current) return;
    if (product === 'full_report' && isReportPaidUnlocked(sessionId, serverPaymentsReady)) {
      onPaid();
      onClose();
      return;
    }
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      showNotice('Откройте Corta из Telegram (кнопка у бота), не во внешнем браузере');
      return;
    }
    payInFlightRef.current = true;
    setPayBusy(true);
    showNotice(null);
    try {
      const r = await openTelegramInvoiceForProduct(product, sessionId);
      if (r.status === 'paid') {
        onPaid();
        onClose();
        return;
      }
      if (r.status === 'redirected') {
        setAwaitingReturn(true);
        showNotice(meta.redirectOpenedMessage);
        return;
      }
      if (r.status === 'skipped') {
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram',
          no_api_url: 'Сервер оплаты не настроен',
          no_init_data: 'Откройте приложение из бота Corta',
          no_open_invoice: 'Обновите Telegram до последней версии',
          no_open_link: 'Обновите Telegram до последней версии',
          payments_disabled:
            'Оплата не настроена на сервере. В Amvera: PAYMENT_PROVIDER=telegram, TELEGRAM_PAYMENT_PROVIDER_TOKEN, пересборка с VITE_PAYMENTS_ENABLED=true',
        };
        const msg = byReason[r.reason];
        if (msg) showNotice(msg);
        return;
      }
      if (r.status === 'cancelled') {
        showNotice('Оплата отменена');
        return;
      }
      if (r.status === 'failed') {
        showNotice(
          product === 'full_report'
            ? 'Оплата не завершена. Попробуйте ещё раз или напишите в техподдержку.'
            : 'Оплата не завершена. Попробуйте ещё раз.',
        );
        return;
      }
      if (r.status === 'error') {
        showNotice(r.message);
      }
    } finally {
      setPayBusy(false);
      payInFlightRef.current = false;
    }
  };

  const handleAlreadyPaidHelp = () => {
    if (product !== 'full_report' || payBusyOnly) return;
    showNotice(null);
    setAlreadyPaidHelpOpen(true);
  };

  const handleCheckPayment = async () => {
    if (product !== 'full_report' || payBusyOnly) return;
    showNotice('Проверяем оплату на сервере…');
    const r = await recoverFullReportAccess(sessionId);
    if (r.ok) {
      onPaid();
      onClose();
      return;
    }
    showNotice(r.message);
  };

  const reportAlreadyPaidHelp = alreadyPaidHelpOpen && product === 'full_report';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-checkout-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <CalmCardShell
        className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col rounded-b-none sm:rounded-3xl"
        innerClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">Оплата</p>
              <h2 id="payment-checkout-title" className="app-heading mt-1 leading-snug">
                {reportAlreadyPaidHelp
                  ? 'Я уже оплатил'
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
                className="w-full rounded-2xl py-3.5 text-sm font-semibold"
                onClick={() => void handleCheckPayment()}
              >
                Проверить оплату и открыть отчёт
              </Button>
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
                  onPaid();
                  onClose();
                }}
              >
                Открыть расширенный отчёт
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="calm-body text-sm text-white/80">{meta.subtitle}</p>

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

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center">
                <p className="text-3xl font-bold tabular-nums leading-none text-white">{meta.priceRub} ₽</p>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{meta.paymentNote}</p>
              </div>

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
          <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="sell"
              disabled={payBusyOnly || awaitingReturn}
              className="w-full shrink-0 rounded-2xl py-4 text-[1.0625rem] font-bold sm:text-lg"
              onClick={() => void handlePay()}
            >
              {payBusy ? 'Открываем оплату…' : awaitingReturn ? 'Оплата открыта' : `Оплатить ${meta.priceRub} ₽`}
            </Button>

            {product === 'full_report' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={payBusyOnly}
                className="w-full shrink-0 rounded-2xl py-3.5 text-sm font-semibold"
                onClick={handleAlreadyPaidHelp}
              >
                Я уже оплатил
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
  );
};
