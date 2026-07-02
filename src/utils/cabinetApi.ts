import type { ParticipantProfile, SessionResult } from '../types';
import { getPaymentsApiUrl } from './telegramPayments';
import { parseParticipantProfile } from './participantProfileStore';
import { getCabinetRedirectUrl, getSupabaseBrowser, resetSupabaseBrowserClient } from './supabaseBrowser';

function cabinetLoginLinkErrorMessage(
  json: { error?: string; message?: string; retryAfterSec?: number },
  fallback?: string,
): string {
  if (json.message?.trim()) return json.message.trim();
  switch (json.error) {
    case 'invalid_email':
      return 'Введите корректный email';
    case 'rate_limit':
      return json.retryAfterSec
        ? `Слишком частые запросы. Подождите ${json.retryAfterSec} сек. и попробуйте снова.`
        : 'Слишком частые запросы. Подождите минуту и попробуйте снова.';
    case 'hourly_limit':
      return 'Слишком много запросов за час. Попробуйте позже или напишите в техподдержку.';
    case 'smtp_not_configured':
      return 'Отправка писем временно недоступна. Напишите в техподдержку Corta.';
    case 'smtp_send_failed':
      return 'Не удалось отправить письмо. Попробуйте позже или напишите в техподдержку.';
    case 'cabinet_not_configured':
      return 'Личный кабинет пока не настроен на сервере.';
    default:
      return fallback || 'Не удалось отправить ссылку. Попробуйте позже.';
  }
}

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

export async function requestMagicLink(email: string): Promise<void> {
  const api = getPaymentsApiUrl();
  if (!api) {
    throw new Error('Сервер не настроен');
  }

  let res: Response;
  try {
    res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/request-login-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        redirectTo: getCabinetRedirectUrl(),
      }),
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте снова.');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(cabinetLoginLinkErrorMessage(json));
  }
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
