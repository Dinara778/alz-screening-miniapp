import type { ParticipantProfile, SessionResult } from '../types';
import { getPaymentsApiUrl } from './telegramPayments';
import { parseParticipantProfile } from './participantProfileStore';
import { getCabinetRedirectUrl, getSupabaseBrowser, resetSupabaseBrowserClient, warmCabinetAuthClient } from './supabaseBrowser';

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
  if (!error) return 'Не удалось отправить код. Попробуйте позже.';
  if (typeof error === 'string' && error.trim()) return error.trim();

  const record =
    typeof error === 'object' && error !== null
      ? (error as { message?: string; code?: string; status?: number; error?: string })
      : null;
  const message = record?.message?.trim() ?? '';
  const code = record?.code?.trim() ?? '';
  const errorCode = record?.error?.trim() ?? '';

  if (/rate limit|over_email_send_rate_limit/i.test(`${code} ${errorCode} ${message}`)) {
    return 'Слишком частые запросы. Подождите 1–2 минуты и попробуйте снова.';
  }
  if (/supabase_unreachable/i.test(`${errorCode} ${message}`)) {
    return 'Не удалось отправить код. Попробуйте через минуту.';
  }
  if (/load failed|failed to fetch|networkerror|network error|fetch/i.test(message)) {
    return 'Нет связи с сервером Corta. Проверьте интернет и попробуйте снова.';
  }
  if (/not configured|cabinet_not_configured|anon public|service_role/i.test(`${errorCode} ${message}`)) {
    return 'Кабинет временно недоступен. Попробуйте позже.';
  }
  if (/smtp|sending confirmation email|error sending/i.test(message)) {
    return 'Письмо не отправилось. Проверьте SMTP в Supabase (Яндекс: smtp.yandex.ru, пароль приложения для «Почта»).';
  }
  if (/redirect|url configuration|invalid.*url/i.test(message)) {
    return 'Неверный адрес возврата. В Supabase добавьте https://cortaapp.ru/cabinet в Redirect URLs.';
  }
  if (/expired/i.test(message)) {
    return 'Код уже недействителен. Нажмите «Отправить код ещё раз» и введите только новый код.';
  }
  if (/invalid|otp|token/i.test(message)) {
    return 'Неверный код. Проверьте цифры или запросите новый.';
  }
  if (message) return message;

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Не удалось выполнить вход. Проверьте email и попробуйте снова.';
}

function cabinetApiBase(): string {
  const api = getPaymentsApiUrl();
  if (!api) throw new Error('Сервер Corta не настроен');
  return api.replace(/\/$/, '');
}

async function postCabinetAuth<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cabinetApiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(formatCabinetAuthError('load failed'));
  }
  const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; message?: string; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(formatCabinetAuthError(json.message || json.error || json));
  }
  return json;
}

/** Отправить одноразовый код на email (шаблон Magic Link в Supabase должен содержать {{ .Token }}). */
export async function requestLoginOtp(email: string): Promise<void> {
  await postCabinetAuth('/api/cabinet/request-otp', {
    email: email.trim().toLowerCase(),
  });
}

export async function verifyLoginOtp(email: string, code: string): Promise<void> {
  const token = code.replace(/\D/g, '').trim();
  if (!/^\d{6,10}$/.test(token)) {
    throw new Error('Введите все цифры из письма (обычно 6 или 8)');
  }
  const normalizedEmail = email.trim().toLowerCase();

  const json = await postCabinetAuth<{
    access_token: string;
    refresh_token: string;
  }>('/api/cabinet/verify-otp', {
    email: normalizedEmail,
    token,
  });

  await warmCabinetAuthClient();
  const supabase = await getSupabaseBrowser();
  const { error } = await supabase.auth.setSession({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
  });
  if (error) throw new Error(formatCabinetAuthError(error));
}

export { warmCabinetAuthClient };

/** @deprecated Используйте requestLoginOtp */
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

/** @deprecated Используйте requestLoginOtp */
export async function requestLoginCode(email: string): Promise<void> {
  return requestLoginOtp(email);
}

/** @deprecated Используйте verifyLoginOtp */
export async function verifyLoginCode(email: string, code: string): Promise<void> {
  return verifyLoginOtp(email, code);
}

export async function signOutCabinet(): Promise<void> {
  const supabase = await getSupabaseBrowser();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  resetSupabaseBrowserClient();
  if (error) throw error;
}

export { useCabinetSession } from './useCabinetSession';
