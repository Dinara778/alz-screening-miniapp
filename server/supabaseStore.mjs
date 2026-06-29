/**
 * Запись в Supabase (service role). Без ключей — no-op.
 */
import { createClient } from '@supabase/supabase-js';

let client = null;

export function isSupabaseConfigured(env = process.env) {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function getClient(env = process.env) {
  if (!isSupabaseConfigured(env)) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
    return null;
  }
  return data?.user_id ?? null;
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

  let userId = null;
  if (email) {
    const user = await upsertUserByEmail(email, env);
    userId = user?.id ?? null;
  }
  if (!userId && sessionId) {
    userId = await findUserIdBySessionId(sessionId, env);
  }
  if (!userId) {
    console.warn('[supabase] recordPayment: user not found for', sessionId);
    return null;
  }

  const row = {
    user_id: userId,
    type,
    amount: Number(amountRub),
    status,
    product: product ?? null,
    session_id: sessionId ? String(sessionId) : null,
    external_id: externalId ? String(externalId) : null,
  };

  const { data, error } = await supabase.from('payments').insert(row).select('id').single();

  if (error) {
    console.error('[supabase] insert payment', error.message);
    return null;
  }
  console.info('[supabase] payment recorded', data.id, product, amountRub);
  return data;
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function getSupabaseHealthInfo(env = process.env) {
  return {
    configured: isSupabaseConfigured(env),
    url: env.SUPABASE_URL?.trim() ? env.SUPABASE_URL.trim().replace(/\/$/, '') : null,
  };
}
