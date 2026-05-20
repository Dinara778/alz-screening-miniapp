import { useEffect, useState } from 'react';
import { CalmCardShell } from '../components/CalmCardShell';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { ScreenBackHeader } from '../components/ScreenBackHeader';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { isDevPaymentBypass } from '../utils/paymentStub';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import {
  consultationPaidStorageKey,
  isPaymentsBackendConfigured,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
} from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

export const ConsultationRequestPage = () => {
  const { setStage, consultationReturnTo, setConsultationReturnTo, participant, latestResult } = useApp();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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

  useEffect(() => {
    if (!latestResult?.id || isDevPaymentBypass()) return;
    const pending = sessionStorage.getItem(prodamusPendingOrderKey(latestResult.id));
    if (!pending) return;
    void pollProdamusOrderPaidQuick(pending, latestResult.id).then((paid) => {
      if (paid) {
        localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
        setPaidOk(true);
      }
    });
  }, [latestResult?.id]);

  const goBack = () => {
    const target = consultationReturnTo ?? 'welcome';
    setConsultationReturnTo(null);
    setStage(target);
  };

  const markConsultationPaid = () => {
    if (!latestResult) return;
    localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
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
  };

  const openCheckout = () => {
    if (!latestResult) {
      setNotice('Нет данных сессии. Вернитесь к результатам и откройте запись снова.');
      return;
    }
    if (isDevPaymentBypass()) {
      markConsultationPaid();
      return;
    }
    setNotice(null);
    if (!isPaymentsBackendConfigured()) {
      setNotice(
        'Оплата в Telegram подключается — скоро здесь можно будет оплатить сессию. Пока напишите в поддержку или на hello@bookvolon.ru.',
      );
      return;
    }
    setCheckoutOpen(true);
  };

  const accent = latestResult
    ? scoreAccentFromValue(buildCognitiveAnalytics(latestResult).index.value)
    : '#34d399';

  const paymentFooter =
    latestResult && !paidOk ? (
      <div className="flex flex-col gap-3">
        {notice ? (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-center text-xs leading-relaxed text-emerald-100/95">
            {notice}
          </p>
        ) : null}
        <Button variant="sell" type="button" className={CTA_BUTTON_CLASS} onClick={openCheckout}>
          Записаться на персональную сессию — 5 490 ₽
        </Button>
      </div>
    ) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!paidOk ? <ScreenBackHeader onBack={goBack} /> : null}
      <ReportFlowShell footer={paymentFooter}>
        <CalmCardShell className="space-y-4">
          <SketchHighlightTitle accent={accent} generousOutline>
            Запись на персональную сессию
          </SketchHighlightTitle>
          {!latestResult ? (
            <p className="mt-3 calm-body dark:text-slate-200">Нет данных прохождения. Вернитесь назад.</p>
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
            <p className="mt-3 calm-body leading-relaxed dark:text-slate-200">
              Сначала оформление в приложении Corta, затем безопасная оплата. После оплаты менеджер свяжется с вами по
              почте из платёжных данных.
            </p>
          )}
        </CalmCardShell>
      </ReportFlowShell>
      {latestResult && !paidOk ? (
        <PaymentCheckoutSheet
          open={checkoutOpen}
          product="consultation"
          sessionId={latestResult.id}
          onClose={() => setCheckoutOpen(false)}
          onPaid={markConsultationPaid}
          onNotice={setNotice}
        />
      ) : null}
    </div>
  );
};
