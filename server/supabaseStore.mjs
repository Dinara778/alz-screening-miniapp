/**
 * Запись в Supabase (service role). Без ключей — no-op.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { isWebPaidForSession } from './webPaidStore.mjs';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

let client = null;

function decodeJwtPayload(jwt) {
  try {
    const part = jwt.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** anon public — для браузера; service_role в SUPABASE_ANON_KEY ломает вход в кабинет. */
export function isAnonPublicKey(key) {
  const payload = decodeJwtPayload(String(key ?? '').trim());
  return payload?.role === 'anon';
}

export function isSupabaseConfigured(env = process.env) {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getClient(env = process.env) {
  if (!isSupabaseConfigured(env)) return null;
  if (!client) {
    try {
      client = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { transport: ws },
      });
    } catch (error) {
      console.error('[supabase] client init failed', error);
      return null;
    }
  }
  return client;
}

function normalizeEmail(email) {
  const e = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!e || !e.includes('@')) return null;
  return e;
}

/** Создать или найти пользователя по email. */
export async function upsertUserByEmail(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = normalizeEmail(email);
  if (!supabase || !normalized) return null;

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id, email, created_at')
    .eq('email', normalized)
    .maybeSingle();

  if (findError) {
    console.error('[supabase] find user', findError.message);
    return null;
  }
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({ email: normalized })
    .select('id, email, created_at')
    .single();

  if (insertError) {
    console.error('[supabase] insert user', insertError.message);
    return null;
  }

  await supabase.from('user_settings').upsert(
    { user_id: created.id, notifications_enabled: false },
    { onConflict: 'user_id' },
  );

  return created;
}

export async function upsertAssessment(
  {
    email,
    sessionId,
    score,
    memoryScore,
    attentionScore,
    speedScore,
    stabilityScore,
    flexibilityScore,
    compensationTip,
    sessionData,
  },
  env = process.env,
) {
  const supabase = getClient(env);
  const sid = String(sessionId ?? '').trim();
  if (!supabase || !sid) return null;

  const user = await upsertUserByEmail(email, env);
  if (!user) return null;

  const row = {
    user_id: user.id,
    session_id: sid,
    score: clampScore(score),
    memory_score: clampScore(memoryScore),
    attention_score: clampScore(attentionScore),
    speed_score: clampScore(speedScore),
    stability_score: stabilityScore == null ? null : clampScore(stabilityScore),
    flexibility_score: flexibilityScore == null ? null : clampScore(flexibilityScore),
    compensation_tip: compensationTip ? String(compensationTip).slice(0, 2000) : null,
    session_data: sessionData && typeof sessionData === 'object' ? sessionData : null,
  };

  const { data, error } = await supabase
    .from('assessments')
    .upsert(row, { onConflict: 'session_id' })
    .select('id, user_id, session_id')
    .single();

  if (error) {
    console.error('[supabase] upsert assessment', error.message);
    return null;
  }
  console.info('[supabase] assessment saved', data.session_id, data.user_id);
  return data;
}

export async function upsertFunnelSession(
  {
    email,
    visitId,
    lastScreen,
    screensPath,
    status = 'in_progress',
    exitReason,
    assessmentSessionId,
  },
  env = process.env,
) {
  const supabase = getClient(env);
  const vid = String(visitId ?? '').trim();
  if (!supabase || !vid) return null;

  const user = await upsertUserByEmail(email, env);
  if (!user) return null;

  const row = {
    user_id: user.id,
    visit_id: vid,
    last_screen: lastScreen ? String(lastScreen).slice(0, 200) : null,
    screens_path: screensPath ? String(screensPath).slice(0, 2000) : null,
    status,
    exit_reason: exitReason ? String(exitReason).slice(0, 120) : null,
    assessment_session_id: assessmentSessionId ? String(assessmentSessionId).slice(0, 80) : null,
  };

  const { data, error } = await supabase
    .from('funnel_sessions')
    .upsert(row, { onConflict: 'visit_id' })
    .select('id, user_id, visit_id, status, last_screen')
    .single();

  if (error) {
    console.error('[supabase] upsert funnel', error.message);
    return null;
  }
  console.info('[supabase] funnel saved', data.visit_id, data.status, data.last_screen);
  return data;
}

export async function findUserIdBySessionId(sessionId, env = process.env) {
  const supabase = getClient(env);
  const sid = String(sessionId ?? '').trim();
  if (!supabase || !sid) return null;

  const { data, error } = await supabase
    .from('assessments')
    .select('user_id')
    .eq('session_id', sid)
    .maybeSingle();

  if (error) {
    console.error('[supabase] find assessment', error.message);
  } else if (data?.user_id) {
    return data.user_id;
  }

  // Оценка могла не синхронизироваться — ищем пользователя по воронке.
  const { data: byAssessment, error: funnelErr } = await supabase
    .from('funnel_sessions')
    .select('user_id')
    .eq('assessment_session_id', sid)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (funnelErr) {
    console.error('[supabase] find funnel by assessment_session_id', funnelErr.message);
  } else if (byAssessment?.user_id) {
    return byAssessment.user_id;
  }

  const { data: byVisit, error: visitErr } = await supabase
    .from('funnel_sessions')
    .select('user_id')
    .eq('visit_id', sid)
    .maybeSingle();
  if (visitErr) {
    console.error('[supabase] find funnel by visit_id', visitErr.message);
    return null;
  }
  return byVisit?.user_id ?? null;
}

export async function userHasSubscriptionRecord({ userId, email }, env = process.env) {
  const supabase = getClient(env);
  if (!supabase) return false;

  let uid = userId ?? null;
  if (!uid) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (userError) {
      console.error('[supabase] subscription record check user', userError.message);
      return false;
    }
    uid = user?.id ?? null;
  }
  if (!uid) return false;

  const { count, error } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid);
  if (error) {
    console.error('[supabase] subscription record check', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function findPaidProductPayment({ sessionId, email, product }, env = process.env) {
  const supabase = getClient(env);
  if (!supabase) return null;
  const sid = String(sessionId ?? '').trim();
  const prod = String(product ?? '').trim();
  const normalizedEmail = normalizeEmail(email);
  if (!prod) return null;

  let payment = null;

  if (sid) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, session_id, product, external_id, created_at')
      .eq('session_id', sid)
      .eq('product', prod)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[supabase] find payment by session', error.message);
    } else if (data) {
      payment = data;
    }
  }

  if (!payment && normalizedEmail) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (userError) {
      console.error('[supabase] find user for payment', userError.message);
      return null;
    }
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from('payments')
      .select('id, session_id, product, external_id, created_at')
      .eq('user_id', user.id)
      .eq('product', prod)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[supabase] find payment by email', error.message);
      return null;
    }
    payment = data ?? null;
  }

  if (!payment) return null;

  // Оплата подписки без строки в subscriptions — ложная запись (счёт без реальной оплаты).
  if (isSubscriptionProduct(prod)) {
    let hasRecord = false;
    if (normalizedEmail) {
      hasRecord = await userHasSubscriptionRecord({ email: normalizedEmail }, env);
    } else if (sid) {
      const uid = await findUserIdBySessionId(sid, env);
      if (uid) hasRecord = await userHasSubscriptionRecord({ userId: uid }, env);
    }
    if (!hasRecord) return null;
  }

  if (prod === 'full_report') {
    const paySid = String(payment.session_id ?? sid ?? '').trim();
    const webPaid = paySid ? isWebPaidForSession(paySid, 'full_report').paid : false;
    const sub = normalizedEmail ? await findActiveSubscriptionByEmail(normalizedEmail, env) : null;
    if (sub?.end_date) return payment;
    if (webPaid && paySid && sid && paySid === sid) return payment;
    return null;
  }

  return payment;
}

export async function reassignPaidPaymentSession(paymentId, sessionId, env = process.env) {
  const supabase = getClient(env);
  const sid = String(sessionId ?? '').trim();
  if (!supabase || !paymentId || !sid) return false;

  const { error } = await supabase.from('payments').update({ session_id: sid }).eq('id', paymentId);
  if (error) {
    console.error('[supabase] reassign payment session', error.message);
    return false;
  }
  return true;
}

export async function recordPayment(
  {
    email,
    sessionId,
    product,
    amountRub,
    type = 'one_time',
    status = 'paid',
    externalId,
  },
  env = process.env,
) {
  const supabase = getClient(env);
  if (!supabase) return null;

  const extId = externalId ? String(externalId) : null;
  if (extId) {
    const { data: existing, error: existingError } = await supabase
      .from('payments')
      .select('id')
      .eq('external_id', extId)
      .maybeSingle();
    if (existingError) {
      console.error('[supabase] find payment by external_id', existingError.message);
    } else if (existing?.id) {
      return existing;
    }
  }

  let userId = null;
  if (email) {
    const user = await upsertUserByEmail(email, env);
    userId = user?.id ?? null;
  }
  if (!userId && sessionId) {
    userId = await findUserIdBySessionId(sessionId, env);
  }
  if (!userId) {
    console.warn(
      '[supabase] recordPayment: user not found — платёж НЕ записан',
      { sessionId, email: email ?? null, product, externalId: extId },
    );
    return null;
  }

  const row = {
    user_id: userId,
    type,
    amount: Number(amountRub),
    status,
    product: product ?? null,
    session_id: sessionId ? String(sessionId) : null,
    external_id: extId,
  };

  const { data, error } = await supabase.from('payments').insert(row).select('id').single();

  if (error) {
    console.error('[supabase] insert payment', error.message);
    return null;
  }
  console.info('[supabase] payment recorded', data.id, product, amountRub);
  return data;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSubscriptionProduct(product) {
  return product === 'subscription_1m' || product === 'subscription_3m';
}

export function subscriptionDaysForProduct(product) {
  if (product === 'subscription_3m') return 90;
  if (product === 'subscription_1m') return 30;
  return 0;
}

export async function findActiveSubscriptionByEmail(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = normalizeEmail(email);
  if (!supabase || !normalized) return null;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (userError || !user?.id) return null;

  const today = formatDateOnly(new Date());
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status, start_date, end_date')
    .eq('user_id', user.id)
    .gte('end_date', today)
    .neq('status', 'inactive')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[supabase] find subscription', error.message);
    return null;
  }
  return data ?? null;
}

export async function activateSubscription({ email, product, days }, env = process.env) {
  const supabase = getClient(env);
  const normalized = normalizeEmail(email);
  const periodDays = Number(days) || subscriptionDaysForProduct(product);
  if (!supabase || !normalized || periodDays <= 0) return null;

  const user = await upsertUserByEmail(normalized, env);
  if (!user?.id) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateOnly(today);

  const { data: existing, error: findError } = await supabase
    .from('subscriptions')
    .select('id, status, start_date, end_date')
    .eq('user_id', user.id)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) {
    console.error('[supabase] find subscription for activate', findError.message);
    return null;
  }

  let baseEnd = today;
  if (existing?.end_date) {
    const existingEnd = new Date(`${existing.end_date}T12:00:00`);
    if (Number.isFinite(existingEnd.getTime()) && existingEnd >= today) {
      baseEnd = existingEnd;
    }
  }
  const endDate = formatDateOnly(addDays(baseEnd, periodDays));

  if (existing?.id) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        end_date: endDate,
        start_date: existing.start_date ?? todayStr,
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[supabase] update subscription', error.message);
      return null;
    }
  } else {
    const { error } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      status: 'active',
      start_date: todayStr,
      end_date: endDate,
    });
    if (error) {
      console.error('[supabase] insert subscription', error.message);
      return null;
    }
  }

  console.info('[supabase] subscription activated', normalized, product, endDate);
  return { endDate, product };
}

export async function cancelSubscription(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = normalizeEmail(email);
  if (!supabase || !normalized) return { ok: false, error: 'not_configured' };

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (userError || !user?.id) return { ok: false, error: 'user_not_found' };

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('id, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (subError) {
    console.error('[supabase] find active subscription', subError.message);
    return { ok: false, error: 'load_failed' };
  }
  if (!sub?.id) return { ok: false, error: 'no_active_subscription' };

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', sub.id);
  if (error) {
    console.error('[supabase] cancel subscription', error.message);
    return { ok: false, error: 'cancel_failed' };
  }

  return { ok: true, endDate: sub.end_date };
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function getSupabaseHealthInfo(env = process.env) {
  const url = env.SUPABASE_URL?.trim() ? env.SUPABASE_URL.trim().replace(/\/$/, '') : null;
  const anonKey = env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || null;
  const anonKeyValid = Boolean(anonKey && isAnonPublicKey(anonKey));
  return {
    configured: isSupabaseConfigured(env),
    url,
    publicBrowser: Boolean(url && anonKeyValid),
    anonKeyMisconfigured: Boolean(anonKey && !anonKeyValid),
  };
}

export function getPublicSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim()?.replace(/\/$/, '');
  const anonKey = env.SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!isAnonPublicKey(anonKey)) {
    console.error(
      '[supabase] SUPABASE_ANON_KEY must be anon public from Supabase → API, not service_role',
    );
    return null;
  }
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}
