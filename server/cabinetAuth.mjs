/**
 * Вход в кабинет: magic link через Supabase Admin + отправка письма своим SMTP.
 * Обходит лимит встроенной почты Supabase («email rate limit exceeded»).
 */
import nodemailer from 'nodemailer';
import { getClient } from './supabaseStore.mjs';

const MIN_INTERVAL_MS = 60_000;
const MAX_PER_HOUR = 8;
const loginLinkRateLimit = new Map();

function isSmtpConfigured(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const from = env.SMTP_FROM?.trim() || user;
  return Boolean(host && user && pass && from);
}

function defaultCabinetUrl(env = process.env) {
  const base = env.PAYMENTS_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, '');
  return base ? `${base}/cabinet` : 'https://cortaapp.ru/cabinet';
}

function isAllowedRedirect(redirectTo, env = process.env) {
  try {
    const url = new URL(redirectTo);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const allowed = new Set(['cortaapp.ru', 'localhost', '127.0.0.1']);
    const base = env.PAYMENTS_PUBLIC_BASE_URL?.trim();
    if (base) {
      const host = new URL(base).hostname;
      if (host) allowed.add(host);
    }
    return allowed.has(url.hostname) && url.pathname.startsWith('/cabinet');
  } catch {
    return false;
  }
}

function checkRateLimit(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  let entry = loginLinkRateLimit.get(key);
  if (!entry) {
    entry = { lastSent: 0, count: 0, windowStart: now };
    loginLinkRateLimit.set(key, entry);
  }
  if (now - entry.windowStart > 3_600_000) {
    entry.count = 0;
    entry.windowStart = now;
  }
  const sinceLast = now - entry.lastSent;
  if (entry.lastSent && sinceLast < MIN_INTERVAL_MS) {
    return {
      ok: false,
      error: 'rate_limit',
      retryAfterSec: Math.ceil((MIN_INTERVAL_MS - sinceLast) / 1000),
    };
  }
  if (entry.count >= MAX_PER_HOUR) {
    return { ok: false, error: 'hourly_limit' };
  }
  entry.lastSent = now;
  entry.count += 1;
  return { ok: true };
}

async function sendCabinetLoginEmail({ to, actionLink, env = process.env }) {
  if (!isSmtpConfigured(env)) {
    return { ok: false, error: 'smtp_not_configured' };
  }

  const host = env.SMTP_HOST.trim();
  const user = env.SMTP_USER.trim();
  const pass = env.SMTP_PASS.trim();
  const from = env.SMTP_FROM?.trim() || user;
  const port = Number(env.SMTP_PORT || 465);
  const secureExplicit = env.SMTP_SECURE;
  const secure =
    secureExplicit === 'true' || (secureExplicit !== 'false' && port === 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = 'Вход в личный кабинет Corta';
  const text = [
    'Здравствуйте!',
    '',
    'Вы запросили ссылку для входа в личный кабинет Corta.',
    'Нажмите на ссылку ниже (лучше в том же браузере, где вы запрашивали вход):',
    '',
    actionLink,
    '',
    'Если вы не запрашивали вход, просто проигнорируйте это письмо.',
    'Ссылка действует ограниченное время.',
    '',
    'Corta',
  ].join('\n');

  const html = `
    <p>Здравствуйте!</p>
    <p>Вы запросили ссылку для входа в личный кабинет <strong>Corta</strong>.</p>
    <p><a href="${actionLink}">Войти в личный кабинет</a></p>
    <p style="color:#666;font-size:13px">Откройте ссылку в том же браузере, где вы запрашивали вход. Если вы не запрашивали вход — проигнорируйте письмо.</p>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"Corta" <${from}>`,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    console.error('[cabinetAuth] smtp', e?.message || e);
    return { ok: false, error: 'smtp_send_failed' };
  }
}

export async function requestCabinetLoginLink(email, redirectTo, env = process.env) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'invalid_email' };
  }

  const rate = checkRateLimit(normalized);
  if (!rate.ok) return rate;

  const supabase = getClient(env);
  if (!supabase) {
    return { ok: false, error: 'cabinet_not_configured' };
  }

  const redirect = String(redirectTo ?? '').trim() || defaultCabinetUrl(env);
  if (!isAllowedRedirect(redirect, env)) {
    return { ok: false, error: 'invalid_redirect' };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalized,
    options: { redirectTo: redirect },
  });

  if (error) {
    console.error('[cabinetAuth] generateLink', error.message);
    const msg = String(error.message || '');
    if (/rate limit/i.test(msg)) {
      return { ok: false, error: 'rate_limit', retryAfterSec: 60 };
    }
    return { ok: false, error: 'link_failed', message: msg };
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    return { ok: false, error: 'link_failed' };
  }

  const sent = await sendCabinetLoginEmail({ to: normalized, actionLink, env });
  if (!sent.ok) return sent;

  return { ok: true };
}

export function cabinetLoginLinkErrorMessage(error, extra = {}) {
  switch (error) {
    case 'invalid_email':
      return 'Введите корректный email';
    case 'rate_limit':
      return extra.retryAfterSec
        ? `Слишком частые запросы. Подождите ${extra.retryAfterSec} сек. и попробуйте снова.`
        : 'Слишком частые запросы. Подождите минуту и попробуйте снова.';
    case 'hourly_limit':
      return 'Слишком много запросов за час. Попробуйте позже или напишите в техподдержку.';
    case 'smtp_not_configured':
      return 'Отправка писем временно недоступна. Напишите в техподдержку Corta.';
    case 'smtp_send_failed':
      return 'Не удалось отправить письмо. Попробуйте позже или напишите в техподдержку.';
    case 'cabinet_not_configured':
      return 'Личный кабинет пока не настроен на сервере.';
    case 'invalid_redirect':
      return 'Некорректный адрес возврата после входа.';
    case 'link_failed':
      return 'Не удалось создать ссылку для входа. Попробуйте позже.';
    default:
      return 'Не удалось отправить ссылку. Попробуйте позже.';
  }
}
