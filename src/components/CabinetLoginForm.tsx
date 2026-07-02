import { useState } from 'react';
import { SameEmailHint } from './SameEmailHint';
import { requestLoginCode, verifyLoginCode } from '../utils/cabinetApi';

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
  const [error, setError] = useState('');
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
      await requestLoginCode(normalizedEmail);
      setStep('code');
      setCode('');
      setMsg(`Код отправлен на ${normalizedEmail}. Проверьте почту (и папку «Спам»).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyCode = async () => {
    const token = code.replace(/\D/g, '').trim();
    if (token.length < 6) {
      setError('Введите 6-значный код из письма');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await verifyLoginCode(normalizedEmail, token);
      onLoggedIn?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный или просроченный код');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cabinet-card cabinet-card-narrow">
      <h1>{title}</h1>
      <p className="cabinet-muted">{subtitle}</p>
      <SameEmailHint className="mb-3" />

      {step === 'email' ? (
        <>
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
            className="cabinet-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onVerifyCode();
            }}
          />
          <button type="button" className="cabinet-btn" disabled={busy} onClick={() => void onVerifyCode()}>
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
