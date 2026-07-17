import { useEffect, useRef, useState } from 'react';
import { SameEmailHint } from './SameEmailHint';
import { requestLoginOtp, verifyLoginOtp, warmCabinetAuthClient } from '../utils/cabinetApi';
import { peekCabinetAuthErrorFromUrl } from '../utils/supabaseBrowser';
import { Button } from './Button';
import { CTA_BUTTON_CLASS } from '../constants/ctaButton';

type Props = {
  title?: string;
  subtitle?: string;
  /** Предзаполненный email (экран «Мы помним ваши данные») */
  initialEmail?: string;
  /** Не давать менять email — сразу вход по коду */
  fixedEmail?: boolean;
  /** Спокойный вид внутри welcome / intro */
  calm?: boolean;
  onLoggedIn?: () => void | Promise<void>;
  onCancel?: () => void;
};

export const CabinetLoginForm = ({
  title = 'Личный кабинет Corta daily',
  subtitle = 'Войдите по email — пришлём код для входа.',
  initialEmail = '',
  fixedEmail = false,
  calm = false,
  onLoggedIn,
  onCancel,
}: Props) => {
  const seed = initialEmail.trim().toLowerCase();
  const [step, setStep] = useState<'email' | 'code'>(
    fixedEmail && seed.includes('@') ? 'code' : 'email',
  );
  const [email, setEmail] = useState(seed);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(() => peekCabinetAuthErrorFromUrl() ?? '');
  const [busy, setBusy] = useState(false);
  const verifyInFlightRef = useRef(false);
  const autoSentRef = useRef(false);

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    void warmCabinetAuthClient();
  }, []);

  useEffect(() => {
    if (step === 'code') void warmCabinetAuthClient();
  }, [step]);

  const onSendCode = async () => {
    if (!normalizedEmail.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await requestLoginOtp(normalizedEmail);
      setStep('code');
      setCode('');
      setMsg(
        `Код отправлен на ${normalizedEmail}. Введите только последний код из письма. Новый запрос отменяет предыдущий.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!fixedEmail || !seed.includes('@') || autoSentRef.current) return;
    autoSentRef.current = true;
    setBusy(true);
    setMsg(`Отправляем код на ${seed}…`);
    void requestLoginOtp(seed)
      .then(() => {
        setStep('code');
        setMsg(
          `Код отправлен на ${seed}. Введите только последний код из письма. Новый запрос отменяет предыдущий.`,
        );
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Не удалось отправить код');
      })
      .finally(() => setBusy(false));
  }, [fixedEmail, seed]);

  const onVerifyCode = async () => {
    if (verifyInFlightRef.current || busy) return;
    verifyInFlightRef.current = true;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await verifyLoginOtp(normalizedEmail, code);
      await onLoggedIn?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setBusy(false);
      verifyInFlightRef.current = false;
    }
  };

  if (calm) {
    const inputClass = 'calm-input';
    return (
      <div className="mx-auto w-full max-w-md space-y-4 text-left">
        {title ? <h2 className="app-heading text-center">{title}</h2> : null}
        {subtitle ? <p className="calm-caption text-center">{subtitle}</p> : null}

        {step === 'email' ? (
          <>
            {!fixedEmail ? <SameEmailHint className="mb-1" /> : null}
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              disabled={fixedEmail}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSendCode();
              }}
            />
            <Button
              type="button"
              className={CTA_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void onSendCode()}
            >
              {busy ? 'Отправка…' : 'Получить код для входа'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              Код отправлен на <strong className="text-white/90">{normalizedEmail}</strong>
            </p>
            <input
              className={`${inputClass} text-center tracking-[0.2em]`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Код из письма"
              maxLength={10}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onVerifyCode();
              }}
            />
            <p className="text-center text-xs leading-relaxed text-white/50">
              Введите все цифры из письма (часто 6 или 8). Код действует около часа.
            </p>
            <Button
              type="button"
              className={CTA_BUTTON_CLASS}
              disabled={busy || !/^\d{6,10}$/.test(code)}
              onClick={() => void onVerifyCode()}
            >
              {busy ? 'Проверяем…' : 'Войти в кабинет'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={`${CTA_BUTTON_CLASS} font-semibold`}
              disabled={busy}
              onClick={() => void onSendCode()}
            >
              Отправить код ещё раз
            </Button>
            {onCancel ? (
              <Button
                type="button"
                variant="secondary"
                className={`${CTA_BUTTON_CLASS} font-semibold`}
                disabled={busy}
                onClick={onCancel}
              >
                Назад
              </Button>
            ) : null}
          </>
        )}

        {msg ? <p className="text-center text-sm text-emerald-300/90">{msg}</p> : null}
        {error ? <p className="text-center text-sm text-rose-300/95">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="cabinet-card cabinet-card-narrow">
      <h1>{title}</h1>
      <p className="cabinet-muted">{subtitle}</p>

      {step === 'email' ? (
        <>
          {!fixedEmail ? <SameEmailHint className="mb-3" /> : null}
          <input
            className="cabinet-input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            disabled={fixedEmail}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSendCode();
            }}
          />
          <button type="button" className="cabinet-btn" disabled={busy} onClick={() => void onSendCode()}>
            {busy ? 'Отправка…' : 'Получить код для входа'}
          </button>
        </>
      ) : (
        <>
          <p className="cabinet-muted" style={{ marginBottom: 12 }}>
            Код отправлен на <strong>{normalizedEmail}</strong>
          </p>
          <input
            className="cabinet-input cabinet-input-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Код из письма"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onVerifyCode();
            }}
          />
          <p className="cabinet-muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.8rem' }}>
            Введите все цифры из письма (часто 6 или 8). Код действует около часа — не нажимайте «Войти» повторно.
          </p>
          <button
            type="button"
            className="cabinet-btn"
            disabled={busy || !/^\d{6,10}$/.test(code)}
            onClick={() => void onVerifyCode()}
          >
            {busy ? 'Проверяем…' : 'Войти'}
          </button>
          {!fixedEmail ? (
            <button
              type="button"
              className="cabinet-btn-secondary"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setMsg('');
              }}
            >
              Другой email
            </button>
          ) : null}
          <button
            type="button"
            className="cabinet-btn-secondary"
            style={{ marginTop: 8 }}
            disabled={busy}
            onClick={() => void onSendCode()}
          >
            Отправить код ещё раз
          </button>
          {onCancel ? (
            <button
              type="button"
              className="cabinet-btn-secondary"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={onCancel}
            >
              Назад
            </button>
          ) : null}
        </>
      )}

      {msg ? <p className="cabinet-success">{msg}</p> : null}
      {error ? <p className="cabinet-error">{error}</p> : null}
    </div>
  );
};
