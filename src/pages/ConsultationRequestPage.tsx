import { FormEvent, useEffect, useState } from 'react';
import { CalmCardShell } from '../components/CalmCardShell';
import { ReportFlowShell } from '../components/results/ReportFlowShell';
import { ScreenBackHeader } from '../components/ScreenBackHeader';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { isDevPaymentBypass, isPaymentsEnabled } from '../utils/paymentStub';
import { SketchHighlightTitle } from '../components/results/SketchHighlightTitle';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import { buildCognitiveAnalytics } from '../utils/cognitiveAnalytics';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { PaymentCheckoutSheet } from '../components/PaymentCheckoutSheet';
import { notifyConsultationLeadServer } from '../utils/consultationLeadNotify';
import {
  consultationPaidStorageKey,
  pollProdamusOrderPaidQuick,
  prodamusPendingOrderKey,
} from '../utils/telegramPayments';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

export const ConsultationRequestPage = () => {
  const { setStage, consultationReturnTo, setConsultationReturnTo, participant, latestResult } = useApp();
  const paymentsOn = isPaymentsEnabled();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [paidOk, setPaidOk] = useState(false);
  const [leadEmail, setLeadEmail] = useState(participant?.email ?? '');
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  useEffect(() => {
    setLeadEmail(participant?.email ?? '');
  }, [participant?.email]);

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
    if (!paymentsOn || !latestResult?.id || isDevPaymentBypass()) return;
    const pending = sessionStorage.getItem(prodamusPendingOrderKey(latestResult.id));
    if (!pending) return;
    void pollProdamusOrderPaidQuick(pending, latestResult.id).then((paid) => {
      if (paid) {
        localStorage.setItem(consultationPaidStorageKey(latestResult.id), '1');
        setPaidOk(true);
      }
    });
  }, [latestResult?.id, paymentsOn]);

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
    if (!latestResult) return;
    if (isDevPaymentBypass()) {
      markConsultationPaid();
      return;
    }
    if (!paymentsOn) return;
    setNotice(null);
    setCheckoutOpen(true);
  };

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!latestResult) return;
    const trimmed = leadEmail.trim();
    if (!trimmed.includes('@')) {
      setNotice('Укажите корректный адрес электронной почты');
      return;
    }
    setNotice(null);
    setLeadBusy(true);
    try {
      const r = await notifyConsultationLeadServer(trimmed, latestResult.id, participant ?? undefined);
      if (!r.ok) {
        setNotice(r.message ?? 'Не удалось отправить заявку. Попробуйте позже.');
        return;
      }
      if (r.skipped) {
        setNotice('Откройте приложение из Telegram и повторите отправку.');
        return;
      }
      setLeadSent(true);
      void sendAnalyticsEventToSheets({
        eventType: 'consultation_manager_request',
        sessionId: latestResult.id,
        stage: 'consultation-request',
        consultationEmail: trimmed,
        participant: participant ?? undefined,
      }).catch(() => {});
    } finally {
      setLeadBusy(false);
    }
  };

  const accent = latestResult
    ? scoreAccentFromValue(buildCognitiveAnalytics(latestResult).index.value)
    : '#34d399';

  const requestDone = paidOk || leadSent;

  const paymentFooter =
    latestResult && !requestDone ? (
      paymentsOn ? (
        <Button variant="sell" type="button" className={CTA_BUTTON_CLASS} onClick={openCheckout}>
          Записаться на персональную сессию — 5 490 ₽
        </Button>
      ) : (
        <form className="flex w-full flex-col gap-3" onSubmit={(e) => void submitLead(e)}>
          <input
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-base text-white placeholder:text-white/35"
            type="email"
            autoComplete="email"
            placeholder="Электронная почта"
            value={leadEmail}
            onChange={(ev) => setLeadEmail(ev.target.value)}
            required
          />
          <Button variant="sell" type="submit" className={CTA_BUTTON_CLASS} disabled={leadBusy}>
            {leadBusy ? 'Отправка…' : 'Оставить заявку на сессию'}
          </Button>
        </form>
      )
    ) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!requestDone ? <ScreenBackHeader onBack={goBack} /> : null}
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
          ) : leadSent ? (
            <>
              <p className="mt-3 text-lg font-semibold text-emerald-200">Заявка отправлена</p>
              <p className="mt-2 calm-body leading-relaxed">
                Менеджер свяжется с вами по почте <span className="text-white/90">{leadEmail.trim()}</span> в
                течение 15 минут для записи на сессию.
              </p>
              <div className="mt-5">
                <Button type="button" className="w-full rounded-2xl py-4 font-bold sm:max-w-sm" onClick={goBack}>
                  Вернуться в приложение
                </Button>
              </div>
            </>
          ) : paymentsOn ? (
            <p className="mt-3 calm-body leading-relaxed dark:text-slate-200">
              Сначала оформление в приложении Corta, затем безопасная оплата. После оплаты менеджер свяжется с вами по
              почте из платёжных данных.
            </p>
          ) : (
            <p className="mt-3 calm-body leading-relaxed dark:text-slate-200">
              Онлайн-оплата картой временно недоступна — мы подключаем новый платёжный сервис. Оставьте почту: менеджер
              свяжется с вами для записи на сессию (5 490 ₽).
            </p>
          )}
          {notice ? <p className="text-sm text-amber-200/90">{notice}</p> : null}
        </CalmCardShell>
      </ReportFlowShell>
      {latestResult && !requestDone && paymentsOn ? (
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
