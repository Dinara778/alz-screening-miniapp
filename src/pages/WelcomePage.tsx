import { FormEvent, useRef, useState } from 'react';
import { Button } from '../components/Button';
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
  const [pcConfidence, setPcConfidence] = useState<ParticipantProfile['pcConfidence']>(3);
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
        pcConfidence,
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
      pcConfidence,
    });
  };

  return (
    <div className="space-y-6">
      <form className="rounded-2xl bg-white p-6 shadow-sm space-y-4" onSubmit={submit}>
        <h1 className="inline-block rounded-xl bg-emerald-900 px-4 py-2 text-3xl font-bold text-white">
          Поведенческий тест на замер индекса когнитивной эффективности (30+)
        </h1>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="font-semibold text-emerald-950">Что измеряет тест:</div>
          <div className="mt-2 space-y-1 text-slate-900">
            <div>1. Скорость обработки информации (как быстро мозг реагирует и переключается).</div>
            <div>2 Стабильность внимания (насколько внимание устойчиво к отвлечениям).</div>
            <div>3. Вариативность реакций (насколько мозг работает &quot;ровно&quot;, без &quot;рывков&quot;).</div>
            <div>4. Рабочая память (удержание информации в моменте).</div>
            <div>5. Когнитивная выносливость (как быстро мозг начинает уставать).</div>
          </div>
        </div>

        <div className="grid gap-3">
          <input className="rounded-xl border p-3" placeholder="Имя" value={name} onChange={(e) => { sendFormStartedEvent('name'); setName(e.target.value); }} required />
          <input className="rounded-xl border p-3" placeholder="Почта" type="email" value={email} onChange={(e) => { sendFormStartedEvent('email'); setEmail(e.target.value); }} required />
          <input className="rounded-xl border p-3" placeholder="Телефон" type="tel" value={phone} onChange={(e) => { sendFormStartedEvent('phone'); setPhone(e.target.value); }} required />
          <select className="rounded-xl border p-3" value={sex} onChange={(e) => { sendFormStartedEvent('sex'); setSex(e.target.value as ParticipantProfile['sex']); }}>
            <option value="Женский">Женский</option>
            <option value="Мужской">Мужской</option>
            <option value="Другой">Другой</option>
          </select>
          <input className="rounded-xl border p-3" placeholder="Возраст" type="number" min={18} max={100} value={age} onChange={(e) => { sendFormStartedEvent('age'); setAge(e.target.value); }} required />
          <input className="rounded-xl border p-3" placeholder="Образование" value={education} onChange={(e) => { sendFormStartedEvent('education'); setEducation(e.target.value); }} required />
          <label className="text-sm text-slate-700">
            Насколько уверенно пользуетесь ПК (1 — только с помощью, 5 — уверенно и часто):
          </label>
          <input className="w-full" type="range" min={1} max={5} step={1} value={pcConfidence} onChange={(e) => { sendFormStartedEvent('pcConfidence'); setPcConfidence(Number(e.target.value) as ParticipantProfile['pcConfidence']); }} />
          <div className="text-sm font-semibold">Оценка: {pcConfidence}</div>
        </div>

        <Button type="submit">Начать</Button>
      </form>
      <Button type="button" variant="secondary" onClick={onHistory}>
        История сессий
      </Button>
    </div>
  );
};
