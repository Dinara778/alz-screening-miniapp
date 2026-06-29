/**
 * Личный кабинет: проверка JWT Supabase Auth и данные пользователя.
 */
import { getClient, getPublicSupabaseConfig, isSupabaseConfigured, upsertUserByEmail } from './supabaseStore.mjs';

export function isCabinetConfigured(env = process.env) {
  return isSupabaseConfigured(env);
}

export async function verifySupabaseAccessToken(accessToken, env = process.env) {
  const supabase = getClient(env);
  const token = String(accessToken ?? '').trim();
  if (!supabase || !token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    console.warn('[cabinet] invalid token', error?.message);
    return null;
  }
  return data.user.email.trim().toLowerCase();
}

function resolveAccessType(subscription, payments) {
  if (subscription?.status === 'active') {
    return {
      type: 'subscription',
      label: 'Подписка активна',
      endDate: subscription.end_date ?? null,
    };
  }
  const hasOneTime = (payments ?? []).some((p) => p.type === 'one_time');
  if (hasOneTime) {
    return {
      type: 'one_time',
      label: 'Разовая покупка отчёта',
      endDate: null,
    };
  }
  return {
    type: 'free',
    label: 'Бесплатный доступ',
    endDate: null,
  };
}

function mapAssessment(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    score: row.score,
    memoryScore: row.memory_score,
    attentionScore: row.attention_score,
    speedScore: row.speed_score,
    stabilityScore: row.stability_score,
    flexibilityScore: row.flexibility_score,
    compensationTip: row.compensation_tip,
    createdAt: row.created_at,
  };
}

export async function getCabinetData(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!supabase || !normalized) return null;

  const user = await upsertUserByEmail(normalized, env);
  if (!user) return null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [assessmentsRes, subscriptionRes, paymentsRes] = await Promise.all([
    supabase
      .from('assessments')
      .select(
        'session_id, score, memory_score, attention_score, speed_score, stability_score, flexibility_score, compensation_tip, created_at',
      )
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(7),
    supabase
      .from('subscriptions')
      .select('status, start_date, end_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('payments')
      .select('type, status, amount, product, created_at')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (assessmentsRes.error) {
    console.error('[cabinet] assessments', assessmentsRes.error.message);
    return null;
  }

  const history = (assessmentsRes.data ?? []).map(mapAssessment);
  const latest = history[0] ?? null;

  return {
    email: user.email,
    latest,
    history,
    compensationTip: latest?.compensationTip ?? null,
    access: resolveAccessType(subscriptionRes.data, paymentsRes.data),
    payments: (paymentsRes.data ?? []).map((p) => ({
      type: p.type,
      amount: Number(p.amount),
      product: p.product,
      createdAt: p.created_at,
    })),
  };
}

export function getCabinetHealthInfo(env = process.env) {
  const pub = getPublicSupabaseConfig(env);
  return {
    configured: isCabinetConfigured(env),
    browserReady: Boolean(pub),
    url: '/cabinet',
    auth: 'supabase_magic_link',
    publicConfigUrl: '/api/public-config',
  };
}
