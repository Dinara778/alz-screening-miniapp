import { FormEvent, useState } from 'react';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { enqueueConsultationRequest } from '../utils/consultationQueue';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

export const ConsultationRequestPage = () => {
  const { setStage, consultationReturnTo, setConsultationReturnTo, participant, latestResult, sessionSeed } =
    useApp();
  const [email, setEmail] = useState(participant?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkHint, setNetworkHint] = useState<string | null>(null);

  const goBack = () => {
    const target = consultationReturnTo ?? 'welcome';
    setConsultationReturnTo(null);
    setStage(target);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Укажите корректный адрес электронной почты');
      return;
    }
    setError(null);
    setNetworkHint(null);
    setBusy(true);
    const sessionId = latestResult?.id ?? String(sessionSeed);
    const payload = {
      eventType: 'consultation_manager_request' as const,
      sessionId,
      stage: 'consultation-request' as const,
      consultationEmail: trimmed,
      participant: participant ?? undefined,
    };

    enqueueConsultationRequest({
      consultationEmail: trimmed,
      sessionId,
      timestamp: new Date().toISOString(),
      eventType: payload.eventType,
      participant: participant ?? undefined,
    });

    const delivered = await sendAnalyticsEventToSheets(payload);
    setSent(true);
    if (!delivered) {
      setNetworkHint(
        'Автоотправка на сервер сейчас недоступна (сеть или переменная VITE_SHEETS_WEBHOOK_URL). Заявка сохранена на устройстве; при необходимости продублируйте почту через «Техподдержку» ниже.',
      );
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Запись на разбор</h1>
        {sent ? (
          <>
            <p className="text-slate-700 leading-relaxed mt-2">
              Спасибо. Наш менеджер свяжется с вами в течение 15 минут.
            </p>
            {networkHint ? <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{networkHint}</p> : null}
          </>
        ) : (
          <>
            <p className="text-slate-700 leading-relaxed mt-2">
              Оставьте вашу почту — наш менеджер свяжется с вами в течение 15 минут.
            </p>
            <form className="space-y-4 mt-4" onSubmit={submit}>
              <input
                className="w-full rounded-xl border border-slate-300 p-3"
                type="email"
                autoComplete="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" type="button" onClick={goBack}>
                  Назад
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Отправка…' : 'Отправить'}
                </Button>
              </div>
            </form>
          </>
        )}
        {sent ? (
          <div className="mt-4">
            <Button variant="secondary" type="button" onClick={goBack}>
              Назад
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
