import { useState } from 'react';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { isPaymentsBackendConfigured, openTelegramInvoiceForProduct } from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

export const ConsultationRequestPage = () => {
  const { setStage, consultationReturnTo, setConsultationReturnTo, participant, latestResult } = useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [paidOk, setPaidOk] = useState(false);

  const goBack = () => {
    const target = consultationReturnTo ?? 'welcome';
    setConsultationReturnTo(null);
    setStage(target);
  };

  const handlePay = async () => {
    if (!latestResult) {
      setNotice('Нет данных сессии. Вернитесь к результатам и откройте запись снова.');
      return;
    }
    setNotice(null);
    if (!isPaymentsBackendConfigured()) {
      setNotice(
        'Оплата в Telegram подключается — скоро здесь можно будет оплатить сессию. Пока напишите в поддержку или на hello@bookvolon.ru.',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await openTelegramInvoiceForProduct('consultation', latestResult.id);
      if (r.status === 'paid') {
        setPaidOk(true);
        void sendAnalyticsEventToSheets({
          eventType: 'consultation_paid',
          sessionId: latestResult.id,
          stage: 'consultation-request',
          participant: participant
            ? {
                name: participant.name,
                email: participant.email,
                phone: participant.phone,
                sex: participant.sex,
                age: participant.age,
                education: participant.education,
                pcConfidence: participant.pcConfidence,
              }
            : undefined,
        }).catch(() => {});
        return;
      }
      if (r.status === 'skipped') {
        const byReason: Record<(typeof r)['reason'], string> = {
          not_telegram: 'Оплата доступна только в Telegram. Откройте мини-приложение из бота.',
          no_api_url: 'Сервер оплаты не настроен.',
          no_init_data: 'Откройте мини-приложение из Telegram (из бота), затем повторите.',
          no_open_invoice: 'Обновите Telegram или откройте мини-приложение в актуальной версии клиента.',
        };
        setNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        setNotice('Оплата отменена.');
        return;
      }
      if (r.status === 'failed') {
        setNotice(`Оплата не завершена (${r.detail}).`);
        return;
      }
      setNotice(r.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-800 dark:bg-slate-800/90">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Запись на персональную сессию</h1>
        {!latestResult ? (
          <>
            <p className="mt-3 text-slate-700 dark:text-slate-200">Нет данных прохождения. Вернитесь назад.</p>
            <div className="mt-4">
              <Button variant="secondary" type="button" onClick={goBack}>
                Назад
              </Button>
            </div>
          </>
        ) : paidOk ? (
          <>
            <p className="mt-3 text-slate-700 leading-relaxed dark:text-slate-200">
              Оплата прошла. Наш менеджер свяжется с вами по почте, указанной при оплате, в течение 15 минут для
              согласования удобного времени сессии.
            </p>
            <div className="mt-4">
              <Button variant="secondary" type="button" onClick={goBack}>
                Назад
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-slate-700 leading-relaxed dark:text-slate-200">
              Нажмите кнопку ниже — откроется оплата в Telegram. После успешной оплаты менеджер свяжется с вами по адресу
              почты из платёжных данных.
            </p>
            {notice ? (
              <p className="mt-3 text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                {notice}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" type="button" onClick={goBack}>
                Назад
              </Button>
              <Button
                variant="sell"
                type="button"
                className="rounded-2xl px-5 py-3 font-bold"
                disabled={busy}
                onClick={() => void handlePay()}
              >
                {busy ? 'Открываем оплату…' : 'Записаться на персональную сессию — 5 490 ₽'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
