import { getPublicSupabaseConfig } from './supabaseStore.mjs';

const AUTH_FETCH_TIMEOUT_MS = 15000;

function authConfig(env = process.env) {
  const cfg = getPublicSupabaseConfig(env);
  if (!cfg) return null;
  return {
    baseUrl: cfg.supabaseUrl,
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
    },
  };
}

function mapAuthError(json, fallback = 'auth_failed') {
  const msg = String(json?.msg || json?.message || json?.error_description || json?.error || '').trim();
  const code = String(json?.error_code || json?.code || '').trim();
  return { error: code || fallback, message: msg || undefined };
}

async function fetchAuth(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw Object.assign(new Error('supabase_timeout'), { code: 'supabase_timeout' });
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestCabinetOtp(email, env = process.env) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'invalid_email', message: 'Введите корректный email' };
  }

  const cfg = authConfig(env);
  if (!cfg) {
    return { ok: false, error: 'cabinet_not_configured', message: 'Кабинет не настроен на сервере' };
  }

  try {
    const res = await fetchAuth(`${cfg.baseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: cfg.headers,
      body: JSON.stringify({
        email: normalized,
        create_user: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const mapped = mapAuthError(json);
      return { ok: false, ...mapped };
    }
    return { ok: true };
  } catch (e) {
    if (e?.code === 'supabase_timeout') {
      return { ok: false, error: 'supabase_timeout', message: 'Отправка кода заняла слишком много времени' };
    }
    console.error('[cabinetOtp] request', e?.message || e);
    return { ok: false, error: 'supabase_unreachable', message: 'Сервер Corta не смог связаться с Supabase' };
  }
}

async function verifyCabinetOtpType(cfg, normalized, code, type) {
  const res = await fetchAuth(`${cfg.baseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: cfg.headers,
    body: JSON.stringify({
      email: normalized,
      token: code,
      type,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json?.access_token && json?.refresh_token) {
    return {
      ok: true,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    };
  }
  const mapped = mapAuthError(json);
  throw Object.assign(new Error(mapped.message || mapped.error || 'invalid_token'), mapped);
}

export async function verifyCabinetOtp(email, token, env = process.env) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const code = String(token ?? '').replace(/\D/g, '').trim();
  if (!normalized.includes('@')) {
    return { ok: false, error: 'invalid_email', message: 'Введите корректный email' };
  }
  if (code.length < 6) {
    return { ok: false, error: 'invalid_token', message: 'Введите все цифры из письма (обычно 6 или 8)' };
  }
  if (code.length > 10) {
    return { ok: false, error: 'invalid_token', message: 'Слишком длинный код' };
  }

  const cfg = authConfig(env);
  if (!cfg) {
    return { ok: false, error: 'cabinet_not_configured', message: 'Кабинет не настроен на сервере' };
  }

  const types = ['email', 'signup'];

  try {
    return await Promise.any(types.map((type) => verifyCabinetOtpType(cfg, normalized, code, type)));
  } catch (e) {
    if (e instanceof AggregateError) {
      const timeout = e.errors.find((err) => err?.code === 'supabase_timeout');
      if (timeout) {
        return { ok: false, error: 'supabase_timeout', message: 'Проверка кода заняла слишком много времени' };
      }
      const last = e.errors[e.errors.length - 1];
      if (last?.message) {
        return { ok: false, error: last.code || 'invalid_token', message: last.message };
      }
    }
    if (e?.code === 'supabase_timeout') {
      return { ok: false, error: 'supabase_timeout', message: 'Проверка кода заняла слишком долго' };
    }
    console.error('[cabinetOtp] verify', e?.message || e);
    return { ok: false, error: 'supabase_unreachable', message: 'Сервер Corta не смог связаться с Supabase' };
  }
}

/** Продлить сессию кабинета по refresh_token (без повторного OTP). */
export async function refreshCabinetSession(refreshToken, env = process.env) {
  const token = String(refreshToken ?? '').trim();
  if (!token) {
    return { ok: false, error: 'invalid_refresh', message: 'Нет refresh_token' };
  }

  const cfg = authConfig(env);
  if (!cfg) {
    return { ok: false, error: 'cabinet_not_configured', message: 'Кабинет не настроен на сервере' };
  }

  try {
    const res = await fetchAuth(`${cfg.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: cfg.headers,
      body: JSON.stringify({ refresh_token: token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.access_token || !json?.refresh_token) {
      const mapped = mapAuthError(json, 'refresh_failed');
      return { ok: false, ...mapped };
    }
    return {
      ok: true,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    };
  } catch (e) {
    if (e?.code === 'supabase_timeout') {
      return { ok: false, error: 'supabase_timeout', message: 'Обновление сессии заняло слишком много времени' };
    }
    console.error('[cabinetOtp] refresh', e?.message || e);
    return { ok: false, error: 'supabase_unreachable', message: 'Сервер Corta не смог связаться с Supabase' };
  }
}
