import type { ParticipantProfile } from '../types';
import { loadHistory } from './storage';

const PROFILE_KEY = 'alz_participant_v1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSex(value: unknown): ParticipantProfile['sex'] | null {
  if (value === 'Мужской' || value === 'Женский') return value;
  return null;
}

function normalizePcConfidence(value: unknown): ParticipantProfile['pcConfidence'] {
  const n = Number(value);
  if (n >= 1 && n <= 5) return n as ParticipantProfile['pcConfidence'];
  return 3;
}

/** Проверка и нормализация профиля из localStorage / session_data / API. */
export function parseParticipantProfile(raw: unknown): ParticipantProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<ParticipantProfile>;
  const email = String(p.email ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;

  const age = Number(p.age);
  if (!Number.isFinite(age) || age < 18 || age > 100) return null;

  const sex = normalizeSex(p.sex);
  if (!sex) return null;

  return {
    name: String(p.name ?? '').trim(),
    email,
    phone: String(p.phone ?? 'Не указано').trim() || 'Не указано',
    sex,
    age,
    education: String(p.education ?? 'Не указано').trim() || 'Не указано',
    educationYears: Number(p.educationYears) > 0 ? Number(p.educationYears) : 12,
    pcConfidence: normalizePcConfidence(p.pcConfidence),
  };
}

export function loadSavedParticipantProfile(): ParticipantProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return parseParticipantProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadParticipantProfileFromHistory(): ParticipantProfile | null {
  for (const session of loadHistory()) {
    const profile = parseParticipantProfile(session.participant);
    if (profile) return profile;
  }
  return null;
}

/** Профиль с этого устройства (сохранённый или из последнего теста). */
export function loadLocalParticipantProfile(): ParticipantProfile | null {
  return loadSavedParticipantProfile() ?? loadParticipantProfileFromHistory();
}

export function saveSavedParticipantProfile(profile: ParticipantProfile | null | undefined): void {
  const parsed = parseParticipantProfile(profile);
  if (!parsed) return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore quota / private mode */
  }
}

export function formatProfileResumeLabel(profile: ParticipantProfile): string {
  const parts: string[] = [];
  if (profile.name.trim()) parts.push(profile.name.trim());
  parts.push(`${profile.age} лет`);
  parts.push(profile.sex === 'Женский' ? 'жен.' : 'муж.');
  return parts.join(', ');
}
