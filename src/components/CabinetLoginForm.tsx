import { useState } from 'react';
import { SameEmailHint } from './SameEmailHint';
import { requestLoginOtp, verifyLoginOtp } from '../utils/cabinetApi';
import { peekCabinetAuthErrorFromUrl } from '../utils/supabaseBrowser';

type Props = {
  title?: string;
  subtitle?: string;
  onLoggedIn?: () => void;
};

export const CabinetLoginForm = ({
  title = 'Личный кабинет Corta',
  subtitle = 'Войдите по email — пришлём код для входа.',
  onLoggedIn,
}: Props) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(() => peekCabinetAuthErrorFromUrl() ?? '');
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

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
      setMsg(`Код отправлен на ${normalizedEmail}. Проверьте входящие и папку «Спам».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyCode = async () => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await verifyLoginOtp(normalizedEmail, code);
      onLoggedIn?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cabinet-card cabinet-card-narrow">
      <h1>{title}</h1>
      <p className="cabinet-muted">{subtitle}</p>

      {step === 'email' ? (
        <>
          <SameEmailHint className="mb-3" />
          <input
            className="cabinet-input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
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
            placeholder="000000"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onVerifyCode();
            }}
          />
          <button
            type="button"
            className="cabinet-btn"
            disabled={busy || code.replace(/\D/g, '').length < 6}
            onClick={() => void onVerifyCode()}
          >
            {busy ? 'Проверяем…' : 'Войти'}
          </button>
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
          <button
            type="button"
            className="cabinet-btn-secondary"
            style={{ marginTop: 8 }}
            disabled={busy}
            onClick={() => void onSendCode()}
          >
            Отправить код ещё раз
          </button>
        </>
      )}

      {msg ? <p className="cabinet-success">{msg}</p> : null}
      {error ? <p className="cabinet-error">{error}</p> : null}
    </div>
  );
};
