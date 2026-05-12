import { FormEvent, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import { ParticipantProfile } from '../types';
import { sendAnalyticsEventToSheets } from '../utils/sheetsWebhook';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

export const WelcomePage = ({ onStart, onHistory }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState<ParticipantProfile['sex']>('Женский');
  const [age, setAge] = useState('');
  const [education, setEducation] = useState('');
  const formSessionIdRef = useRef(`welcome-${Date.now()}`);
  const hasSentFormStartRef = useRef(false);

  const sendFormStartedEvent = (triggerField: string) => {
    if (hasSentFormStartRef.current) return;
    hasSentFormStartRef.current = true;
    void sendAnalyticsEventToSheets({
      eventType: 'form_started',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      triggerField,
      participant: {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
    }).catch(() => {
      // Ignore analytics errors to keep UX stable.
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const parsedAge = Number(age);
    if (!name.trim() || !normalizedEmail || !normalizedPhone || !education.trim() || !Number.isFinite(parsedAge)) return;

    void sendAnalyticsEventToSheets({
      eventType: 'form_submitted',
      sessionId: formSessionIdRef.current,
      stage: 'welcome',
      participant: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        sex,
        age: parsedAge,
        education: education.trim(),
        pcConfidence: 3,
      },
    }).catch(() => {
      // Ignore analytics errors to keep UX stable.
    });

    onStart({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      sex,
      age: parsedAge,
      education: education.trim(),
      educationYears: 12,
      pcConfidence: 3,
    });
  };

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-2xl border border-emerald-100/80 bg-white/95 p-6 shadow-brand-lg backdrop-blur-sm dark:border-emerald-900/40 dark:bg-slate-800/90"
        onSubmit={submit}
      >
        <h1 className="inline-block rounded-xl bg-gradient-to-br from-emerald-900 to-teal-950 px-4 py-3 text-2xl font-bold leading-tight text-white shadow-md sm:text-3xl">
          🧠 Тест: индекс когнитивной эффективности
        </h1>
        <div className="rounded-xl border-2 border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/80 p-4 dark:border-emerald-700/50 dark:from-emerald-950/50 dark:to-slate-800/80">
          <div className="font-semibold text-emerald-950 dark:text-emerald-100">📋 Что измеряет тест</div>
          <div className="mt-2 space-y-2 text-slate-900 dark:text-slate-200">
            <div>⚡ Скорость обработки информации (как быстро мозг реагирует и переключается).</div>
            <div>🎯 Стабильность внимания (насколько внимание устойчиво к отвлечениям).</div>
            <div>〰️ Вариативность реакций (насколько мозг работает &quot;ровно&quot;, без &quot;рывков&quot;).</div>
            <div>🧩 Рабочая память (удержание информации в моменте).</div>
            <div>💪 Когнитивная выносливость (как быстро мозг начинает уставать).</div>
          </div>
        </div>

        <div className="grid gap-3">
          <input
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            placeholder="Имя"
            value={name}
            onChange={(e) => {
              sendFormStartedEvent('name');
              setName(e.target.value);
            }}
            required
          />
          <input
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            placeholder="Почта"
            type="email"
            value={email}
            onChange={(e) => {
              sendFormStartedEvent('email');
              setEmail(e.target.value);
            }}
            required
          />
          <input
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            placeholder="Телефон"
            type="tel"
            value={phone}
            onChange={(e) => {
              sendFormStartedEvent('phone');
              setPhone(e.target.value);
            }}
            required
          />
          <select
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            value={sex}
            onChange={(e) => {
              sendFormStartedEvent('sex');
              setSex(e.target.value as ParticipantProfile['sex']);
            }}
          >
            <option value="Женский">Женский</option>
            <option value="Мужской">Мужской</option>
            <option value="Другой">Другой</option>
          </select>
          <input
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            placeholder="Возраст"
            type="number"
            min={18}
            max={100}
            value={age}
            onChange={(e) => {
              sendFormStartedEvent('age');
              setAge(e.target.value);
            }}
            required
          />
          <input
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/50"
            placeholder="Образование"
            value={education}
            onChange={(e) => {
              sendFormStartedEvent('education');
              setEducation(e.target.value);
            }}
            required
          />
        </div>

        <Button type="submit">✨ Начать тест</Button>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">🕒 Около 5 минут · без медицинского диагноза</p>
      </form>
      <Button type="button" variant="secondary" onClick={onHistory}>
        📚 История прохождений
      </Button>
      <Footer />
    </div>
  );
};
