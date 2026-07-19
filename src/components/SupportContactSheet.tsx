import { useEffect, useState } from 'react';
import { Button } from './Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../constants/supportContact';
import { sendSupportLead } from '../utils/supportLead';

type Props = {
  open: boolean;
  onClose: () => void;
  initialEmail?: string | null;
  sessionId?: string | null;
  screen?: string | null;
};

export const SupportContactSheet = ({
  open,
  onClose,
  initialEmail = null,
  sessionId = null,
  screen = null,
}: Props) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail?.trim().toLowerCase() || '');
    setMessage('');
    setError(null);
    setSent(false);
    setBusy(false);
  }, [open, initialEmail]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const result = await sendSupportLead({
      email: email.trim().toLowerCase(),
      message: message.trim(),
      sessionId: sessionId || undefined,
      screen: screen || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1210] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl sm:px-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="support-sheet-title" className="text-lg font-bold text-white">
              Техподдержка
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Ответим на почту {SUPPORT_EMAIL}
            </p>
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

        {sent ? (
          <div className="space-y-4 py-2">
            <p className="text-base leading-relaxed text-emerald-100/95">
              Сообщение отправлено. Ответим на {email.trim().toLowerCase()}.
            </p>
            <Button type="button" className={CTA_BUTTON_CLASS} onClick={onClose}>
              Готово
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-white/60">Ваш email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="calm-input w-full"
                placeholder="you@email.com"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-white/60">Сообщение</span>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="calm-input w-full resize-y min-h-[7rem]"
                placeholder="Опишите проблему: что делали, что увидели…"
                maxLength={4000}
              />
            </label>

            {error ? (
              <p className="text-sm leading-snug text-amber-200/95">{error}</p>
            ) : null}

            <Button type="submit" className={CTA_BUTTON_CLASS} disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить'}
            </Button>

            <p className="text-center text-xs text-white/45">
              Или напишите напрямую:{' '}
              <a href={SUPPORT_MAILTO} className="text-teal-300/90 underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
