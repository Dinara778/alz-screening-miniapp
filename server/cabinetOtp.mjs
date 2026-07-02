import { getPublicSupabaseConfig } from './supabaseStore.mjs';

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
    const res = await fetch(`${cfg.baseUrl}/auth/v1/otp`, {
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
    console.error('[cabinetOtp] request', e?.message || e);
    return { ok: false, error: 'supabase_unreachable', message: 'Сервер Corta не смог связаться с Supabase' };
  }
}

export async function verifyCabinetOtp(email, token, env = process.env) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const code = String(token ?? '').replace(/\D/g, '').trim();
  if (!normalized.includes('@')) {
    return { ok: false, error: 'invalid_email', message: 'Введите корректный email' };
  }
  if (code.length < 6) {
    return { ok: false, error: 'invalid_token', message: 'Введите код из письма полностью' };
  }

  const cfg = authConfig(env);
  if (!cfg) {
    return { ok: false, error: 'cabinet_not_configured', message: 'Кабинет не настроен на сервере' };
  }

  const types = ['email', 'signup'];
  let last = null;

  for (const type of types) {
    try {
      const res = await fetch(`${cfg.baseUrl}/auth/v1/verify`, {
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
      last = mapAuthError(json);
    } catch (e) {
      console.error('[cabinetOtp] verify', e?.message || e);
      return { ok: false, error: 'supabase_unreachable', message: 'Сервер Corta не смог связаться с Supabase' };
    }
  }

  return { ok: false, ...(last || { error: 'invalid_token' }) };
}
