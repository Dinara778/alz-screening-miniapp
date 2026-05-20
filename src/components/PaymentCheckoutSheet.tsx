import { useEffect, useState } from 'react';
import { Button } from './Button';
import { CalmCardShell } from './CalmCardShell';
import { PAYMENT_PRODUCTS } from '../utils/paymentProducts';
import {
  isReportPaidUnlocked,
  openTelegramInvoiceForProduct,
  prodamusPendingOrderKey,
  tryRecoverReportAccess,
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

/**
 * Оформление в дизайне Corta. Данные карты здесь не вводятся — только счёт;
 * оплата идёт через Telegram или защищённую страницу Prodamus (требование банков).
 */
export const PaymentCheckoutSheet = ({
  open,
  product,
  sessionId,
  onClose,
  onPaid,
  onNotice,
}: Props) => {
  const meta = PAYMENT_PRODUCTS[product];
  const [busy, setBusy] = useState(false);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(() =>
    product === 'full_report' ? isReportPaidUnlocked(sessionId) : false,
  );

  useEffect(() => {
    if (!open || product !== 'full_report') return;
    setAlreadyPaid(isReportPaidUnlocked(sessionId));
  }, [open, product, sessionId]);

  if (!open) return null;

  const handlePay = async () => {
    if (product === 'full_report' && isReportPaidUnlocked(sessionId)) {
      onPaid();
      onClose();
      return;
    }
    setBusy(true);
    onNotice(null);
    try {
      const r = await openTelegramInvoiceForProduct(product, sessionId);
      if (r.status === 'paid') {
        onPaid();
        onClose();
        return;
      }
      if (r.status === 'redirected') {
        sessionStorage.setItem(prodamusPendingOrderKey(sessionId), r.orderId);
        onNotice(
          'Оплата уже была — не платите повторно, если деньги списались. Закройте страницу оплаты и снова откройте Corta из бота. Нажмите «Я уже оплатил» ниже.',
        );
        onClose();
        return;
      }
      if (r.status === 'skipped') {
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram',
          no_api_url: 'Сервер оплаты не настроен',
          no_init_data: 'Откройте приложение из бота Corta',
          no_open_invoice: 'Обновите Telegram до последней версии',
          no_open_link: 'Обновите Telegram до последней версии',
        };
        onNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        onNotice('Оплата отменена');
        return;
      }
      if (r.status === 'failed') {
        onNotice('Оплата не завершена. Если деньги уже списались — нажмите «Я уже оплатил».');
        return;
      }
      if (r.status === 'error') {
        onNotice(r.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAlreadyPaid = async () => {
    if (product !== 'full_report') return;
    setRecoverBusy(true);
    onNotice(null);
    try {
      const ok = await tryRecoverReportAccess(sessionId);
      if (ok) {
        setAlreadyPaid(true);
        onPaid();
        onClose();
        return;
      }
      onNotice(
        'Оплату на сервере не видим. Закройте приложение, откройте Corta снова из бота. Если списание было — напишите в поддержку с датой и @username.',
      );
    } finally {
      setRecoverBusy(false);
    }
  };

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
        className="relative z-10 max-h-[92dvh] w-full max-w-md rounded-b-none sm:rounded-3xl"
        innerClassName="gap-4 p-5 pb-8 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">Оплата</p>
            <h2 id="payment-checkout-title" className="app-heading mt-1 text-xl">
              {alreadyPaid && product === 'full_report' ? 'Доступ уже есть' : meta.title}
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

        {alreadyPaid && product === 'full_report' ? (
          <>
            <p className="calm-body text-sm text-emerald-100/95">
              Оплата за этот результат уже учтена. Повторно платить не нужно — откройте расширенный отчёт.
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
          </>
        ) : (
          <>
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

            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/95">
              Если 399 ₽ уже списались — не оплачивайте снова. Нажмите «Я уже оплатил».
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-3xl font-bold tabular-nums text-white">{meta.priceRub} ₽</p>
              <p className="mt-1 text-xs text-white/55">Безопасная оплата · чек на email при необходимости</p>
            </div>

            <Button
              type="button"
              variant="sell"
              disabled={busy || recoverBusy}
              className="w-full rounded-2xl py-4 text-[1.0625rem] font-bold sm:text-lg"
              onClick={() => void handlePay()}
            >
              {busy ? 'Подключаем оплату…' : `Оплатить ${meta.priceRub} ₽`}
            </Button>

            {product === 'full_report' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || recoverBusy}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold"
                onClick={() => void handleAlreadyPaid()}
              >
                {recoverBusy ? 'Проверяем оплату…' : 'Я уже оплатил — открыть отчёт'}
              </Button>
            ) : null}
          </>
        )}

        <button
          type="button"
          className="w-full py-2 text-sm text-white/45 hover:text-white/70"
          onClick={onClose}
        >
          Назад
        </button>
      </CalmCardShell>
    </div>
  );
};
