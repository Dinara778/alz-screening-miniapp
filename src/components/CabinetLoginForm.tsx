import { useState } from 'react';
import { SameEmailHint } from './SameEmailHint';
import { requestMagicLink } from '../utils/cabinetApi';
import { peekCabinetAuthErrorFromUrl } from '../utils/supabaseBrowser';

type Props = {
  title?: string;
  subtitle?: string;
  /** Не используется при входе по ссылке — сессия подхватывается автоматически */
  onLoggedIn?: () => void;
};

export const CabinetLoginForm = ({
  title = 'Личный кабинет Corta',
  subtitle = 'Войдите по email — пришлём ссылку для входа.',
  onLoggedIn,
}: Props) => {
  const [step, setStep] = useState<'email' | 'link-sent'>('email');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(() => peekCabinetAuthErrorFromUrl() ?? '');
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const onSendLink = async () => {
    if (!normalizedEmail.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await requestMagicLink(normalizedEmail);
      setStep('link-sent');
      setMsg(
        `Ссылка отправлена на ${normalizedEmail}. Откройте письмо и нажмите «Войти» — лучше в том же браузере, где вы запрашивали вход. Проверьте папку «Спам».`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить ссылку');
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
              if (e.key === 'Enter') void onSendLink();
            }}
          />
          <button type="button" className="cabinet-btn" disabled={busy} onClick={() => void onSendLink()}>
            {busy ? 'Отправка…' : 'Получить ссылку для входа'}
          </button>
        </>
      ) : (
        <>
          <p className="cabinet-muted" style={{ marginBottom: 12 }}>
            Письмо отправлено на <strong>{normalizedEmail}</strong>
          </p>
          <p className="cabinet-muted" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
            После перехода по ссылке эта страница откроет кабинет автоматически.
          </p>
          <button
            type="button"
            className="cabinet-btn-secondary"
            style={{ marginTop: 8 }}
            disabled={busy}
            onClick={() => {
              setStep('email');
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
            onClick={() => void onSendLink()}
          >
            Отправить ссылку ещё раз
          </button>
        </>
      )}

      {msg ? <p className="cabinet-success">{msg}</p> : null}
      {error ? <p className="cabinet-error">{error}</p> : null}
    </div>
  );
};
