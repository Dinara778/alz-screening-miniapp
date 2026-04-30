import { FormEvent, useState } from 'react';
import { Button } from '../components/Button';
import { ParticipantProfile } from '../types';

type Props = { onStart: (profile: ParticipantProfile) => void; onHistory: () => void };

export const WelcomePage = ({ onStart, onHistory }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState<ParticipantProfile['sex']>('Женский');
  const [age, setAge] = useState('');
  const [education, setEducation] = useState('');
  const [educationYears, setEducationYears] = useState('');
  const [pcConfidence, setPcConfidence] = useState<ParticipantProfile['pcConfidence']>(3);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const parsedAge = Number(age);
    const parsedEducationYears = Number(educationYears);
    if (!name.trim() || !normalizedEmail || !normalizedPhone || !education.trim() || !Number.isFinite(parsedAge) || !Number.isFinite(parsedEducationYears)) return;

    onStart({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      sex,
      age: parsedAge,
      education: education.trim(),
      educationYears: parsedEducationYears,
      pcConfidence,
    });
  };

  return (
    <div className="space-y-6">
      <form className="rounded-2xl bg-white p-6 shadow-sm space-y-4" onSubmit={submit}>
        <h1 className="inline-block rounded-xl bg-emerald-900 px-4 py-2 text-3xl font-bold text-white">
          Когнитивный скрининг для возраста 40+
        </h1>
        <div className="space-y-2">
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-900 font-bold">
            Это не медицинская диагностика и не заменяет визит к врачу.
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-slate-800">
            Данный сервис позволяет оценить состояние вашего текущего когнитивного статуса, а так же определить риск
            когнитивных нарушений в будущем.
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-slate-800">
            После прохождения первичного теста вы узнаете свой риск-статус и получите адресную рекомендацию.
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-slate-800">
            Прохождение теста занимает 7-15 минут. Лучше пройти в тихой обстановке.
          </div>
        </div>

        <div className="grid gap-3">
          <input className="rounded-xl border p-3" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-xl border p-3" placeholder="Почта" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded-xl border p-3" placeholder="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <select className="rounded-xl border p-3" value={sex} onChange={(e) => setSex(e.target.value as ParticipantProfile['sex'])}>
            <option value="Женский">Женский</option>
            <option value="Мужской">Мужской</option>
            <option value="Другой">Другой</option>
          </select>
          <input className="rounded-xl border p-3" placeholder="Возраст" type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} required />
          <input className="rounded-xl border p-3" placeholder="Образование" value={education} onChange={(e) => setEducation(e.target.value)} required />
          <input className="rounded-xl border p-3" placeholder="Лет образования" type="number" min={1} max={30} value={educationYears} onChange={(e) => setEducationYears(e.target.value)} required />
          <label className="text-sm text-slate-700">
            Насколько уверенно пользуетесь ПК (1 — только с помощью, 5 — уверенно и часто):
          </label>
          <input className="w-full" type="range" min={1} max={5} step={1} value={pcConfidence} onChange={(e) => setPcConfidence(Number(e.target.value) as ParticipantProfile['pcConfidence'])} />
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
