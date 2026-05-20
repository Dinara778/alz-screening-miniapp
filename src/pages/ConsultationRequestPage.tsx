import { useEffect, useState } from 'react';
import { ScreenBackHeader } from '../components/ScreenBackHeader';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { isPaymentsStubbed } from '../utils/paymentStub';
import { SupportFooter } from '../components/SupportFooter';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import {
  consultationPaidStorageKey,
  isPaymentsBackendConfigured,
  openTelegramInvoiceForProduct,
} from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

export const ConsultationRequestPage = () => {
  const { setStage, consultationReturnTo, setConsultationReturnTo, participant, latestResult } = useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [paidOk, setPaidOk] = useState(false);

  useEffect(() => {
    if (!latestResult?.id) return;
    const sync = () => {
      if (localStorage.getItem(consultationPaidStorageKey(latestResult.id)) === '1') {
        setPaidOk(true);
      }
    };
    sync();
    window.addEventListener('consultation-paid', sync);
    return () => window.removeEventListener('consultation-paid', sync);
  }, [latestResult?.id]);

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
    if (isPaymentsStubbed()) {
      localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
      setPaidOk(true);
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
        if (latestResult?.id) {
          localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
        }
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
          no_open_link: 'Обновите Telegram: для оплаты картой нужна актуальная версия с открытием ссылки.',
        };
        setNotice(byReason[r.reason]);
        return;
      }
      if (r.status === 'cancelled') {
        setNotice('Оплата отменена.');
        return;
      }
      if (r.status === 'failed') {
        if (r.detail === 'prodamus_timeout') {
          setNotice(
            'Не удалось дождаться подтверждения оплаты. Если платёж прошёл, закройте мини-приложение и откройте его снова из бота.',
          );
          return;
        }
        setNotice(`Оплата не завершена (${r.detail}).`);
        return;
      }
      setNotice(r.message);
    } finally {
      setBusy(false);
    }
  };

  const accent = latestResult
    ? scoreAccentFromValue(buildCognitiveAnalytics(latestResult).index.value)
    : '#34d399';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col pb-4">
      {!paidOk ? <ScreenBackHeader onBack={goBack} /> : null}
      <div className="calm-card space-y-4">
        <SketchHighlightTitle accent={accent}>Запись на персональную сессию</SketchHighlightTitle>
        {!latestResult ? (
          <>
            <p className="mt-3 calm-body dark:text-slate-200">Нет данных прохождения. Вернитесь назад.</p>
          </>
        ) : paidOk ? (
          <>
            <p className="mt-3 text-lg font-semibold text-emerald-200">Спасибо за оплату!</p>
            <p className="mt-2 calm-body leading-relaxed">
              Мы свяжемся с вами по указанной вами почте в течение 15 минут.
            </p>
            <div className="mt-5">
              <Button type="button" className="w-full rounded-2xl py-4 font-bold sm:max-w-sm" onClick={goBack}>
                Вернуться в приложение
              </Button>
            </div>
          </>
        ) : (
          <div className="flex min-h-[42vh] flex-col">
            <p className="mt-3 calm-body leading-relaxed dark:text-slate-200">
              Нажмите кнопку ниже — откроется оплата в Telegram. После успешной оплаты менеджер свяжется с вами по адресу
              почты из платёжных данных.
            </p>
            {notice ? (
              <p className="mt-3 text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                {notice}
              </p>
            ) : null}
            <div className="mt-auto flex flex-col gap-3 pt-5">
              <Button
                variant="sell"
                type="button"
                className={`${CTA_BUTTON_CLASS} mt-2`}
                disabled={busy}
                onClick={() => void handlePay()}
              >
                {busy ? 'Открываем оплату…' : 'Записаться на персональную сессию — 5 490 ₽'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-auto">
        <SupportFooter showDeveloperCredit={false} />
      </div>
    </div>
  );
};
