import type { ParticipantProfile, SessionResult } from '../types';
import { getPaymentsApiUrl } from './telegramPayments';
import { parseParticipantProfile } from './participantProfileStore';
import { getCabinetRedirectUrl, getSupabaseBrowser, resetSupabaseBrowserClient } from './supabaseBrowser';

export type CabinetAssessment = {
  sessionId: string;
  score: number;
  memoryScore: number;
  attentionScore: number;
  speedScore: number;
  stabilityScore: number | null;
  flexibilityScore: number | null;
  compensationTip: string | null;
  createdAt: string;
  canOpenReport: boolean;
  hasReportData: boolean;
};

export type CabinetPayment = {
  type: string;
  amount: number;
  product: string | null;
  sessionId: string | null;
  externalId: string | null;
  createdAt: string;
};

export type CabinetData = {
  email: string;
  latest: CabinetAssessment | null;
  history7d: CabinetAssessment[];
  historyAll: CabinetAssessment[];
  /** @deprecated используйте history7d */
  history: CabinetAssessment[];
  compensationTip: string | null;
  access: {
    type: 'subscription' | 'one_time' | 'free';
    label: string;
    endDate: string | null;
  };
  subscription: {
    planLabel: string;
    status: string;
    endDate: string;
    canCancel: boolean;
  } | null;
  payments: CabinetPayment[];
};

export async function cancelCabinetSubscription(accessToken: string): Promise<{ endDate: string }> {
  const api = getPaymentsApiUrl();
  if (!api) throw new Error('API не настроен');
  const res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/cancel-subscription`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Не удалось отменить подписку');
  }
  return { endDate: String(json.endDate ?? '') };
}

export function cabinetReportUrl(sessionId: string): string {
  return `/cabinet/report?session=${encodeURIComponent(sessionId)}`;
}

export async function fetchCabinetData(accessToken: string): Promise<CabinetData> {
  const api = getPaymentsApiUrl();
  if (!api) throw new Error('API не настроен');
  const res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Не удалось загрузить кабинет');
  }
  return json.data as CabinetData;
}

export async function fetchCabinetReport(
  accessToken: string,
  sessionId: string,
): Promise<SessionResult> {
  const api = getPaymentsApiUrl();
  if (!api) throw new Error('API не настроен');
  const res = await fetch(
    `${api.replace(/\/$/, '')}/api/cabinet/report/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.message || json.error || 'Не удалось открыть отчёт');
  }
  return json.session as SessionResult;
}

export async function fetchCabinetParticipantProfile(
  accessToken: string,
): Promise<ParticipantProfile | null> {
  const api = getPaymentsApiUrl();
  if (!api) return null;
  const res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/participant-profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) return null;
  return parseParticipantProfile(json.profile);
}

export function formatCabinetAuthError(error: unknown): string {
  if (!error) return 'Не удалось отправить ссылку. Попробуйте позже.';
  if (typeof error === 'string' && error.trim()) return error.trim();

  const record =
    typeof error === 'object' && error !== null
      ? (error as { message?: string; code?: string; status?: number })
      : null;
  const message = record?.message?.trim() ?? '';
  const code = record?.code?.trim() ?? '';

  if (/rate limit|over_email_send_rate_limit/i.test(`${code} ${message}`)) {
    return 'Слишком частые запросы. Подождите 1–2 минуты и попробуйте снова.';
  }
  if (/smtp|sending confirmation email|error sending/i.test(message)) {
    return 'Письмо не отправилось. Проверьте SMTP в Supabase (Яндекс: smtp.yandex.ru, пароль приложения для «Почта»).';
  }
  if (/redirect|url configuration|invalid.*url/i.test(message)) {
    return 'Неверный адрес возврата. В Supabase добавьте https://cortaapp.ru/cabinet в Redirect URLs.';
  }
  if (message) return message;

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Не удалось отправить ссылку. Проверьте email и настройки почты в Supabase.';
}

export async function requestMagicLink(email: string): Promise<void> {
  const supabase = await getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: getCabinetRedirectUrl(),
    },
  });
  if (error) throw new Error(formatCabinetAuthError(error));
}

/** @deprecated Используйте requestMagicLink */
export async function requestLoginCode(email: string): Promise<void> {
  return requestMagicLink(email);
}

/** @deprecated Вход по ссылке — код на экране не нужен */
export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const supabase = await getSupabaseBrowser();
  const token = code.replace(/\D/g, '').trim();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  });
  if (error) throw error;
}

export async function signOutCabinet(): Promise<void> {
  const supabase = await getSupabaseBrowser();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  resetSupabaseBrowserClient();
  if (error) throw error;
}

export { useCabinetSession } from './useCabinetSession';
