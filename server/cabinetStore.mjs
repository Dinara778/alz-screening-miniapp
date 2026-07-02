/**
 * Личный кабинет: проверка JWT Supabase Auth и данные пользователя.
 */
import { getClient, getPublicSupabaseConfig, isSupabaseConfigured, upsertUserByEmail } from './supabaseStore.mjs';

const HISTORY_ALL_LIMIT = 200;
const HISTORY_7D_CAP = 100;

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
  const hasOneTime = (payments ?? []).some((p) => p.type === 'one_time' && p.status === 'paid');
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

function mapAssessment(row, { canOpenReport = false, hasReportData = false } = {}) {
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
    canOpenReport,
    hasReportData,
  };
}

function canOpenReportForSession(sessionId, subscription, payments) {
  if (subscription?.status === 'active') return true;
  const paidReports = (payments ?? []).filter(
    (p) => p.status === 'paid' && p.product === 'full_report',
  );
  if (!paidReports.length) return false;
  if (paidReports.some((p) => p.session_id === sessionId)) return true;
  if (paidReports.length === 1 && !paidReports[0].session_id) return true;
  return false;
}

const ASSESSMENT_SELECT =
  'session_id, score, memory_score, attention_score, speed_score, stability_score, flexibility_score, compensation_tip, created_at, session_data';

function enrichAssessments(rows, subscription, payments) {
  return (rows ?? []).map((row) => {
    const hasReportData = Boolean(row.session_data && typeof row.session_data === 'object');
    const canOpenReport =
      hasReportData && canOpenReportForSession(row.session_id, subscription, payments);
    return mapAssessment(row, { canOpenReport, hasReportData });
  });
}

export async function getCabinetData(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!supabase || !normalized) return null;

  const user = await upsertUserByEmail(normalized, env);
  if (!user) return null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [history7dRes, historyAllRes, subscriptionRes, paymentsRes] = await Promise.all([
    supabase
      .from('assessments')
      .select(ASSESSMENT_SELECT)
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(HISTORY_7D_CAP),
    supabase
      .from('assessments')
      .select(ASSESSMENT_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_ALL_LIMIT),
    supabase
      .from('subscriptions')
      .select('status, start_date, end_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('payments')
      .select('type, status, amount, product, session_id, external_id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (history7dRes.error || historyAllRes.error) {
    console.error('[cabinet] assessments', history7dRes.error?.message, historyAllRes.error?.message);
    return null;
  }

  const payments = paymentsRes.data ?? [];
  const subscription = subscriptionRes.data;
  const history7d = enrichAssessments(history7dRes.data, subscription, payments);
  const historyAll = enrichAssessments(historyAllRes.data, subscription, payments);
  const latest = history7d[0] ?? historyAll[0] ?? null;

  return {
    email: user.email,
    latest,
    history7d,
    history: history7d,
    historyAll,
    compensationTip: latest?.compensationTip ?? null,
    access: resolveAccessType(subscription, payments),
    payments: payments.map((p) => ({
      type: p.type,
      amount: Number(p.amount),
      product: p.product,
      sessionId: p.session_id,
      externalId: p.external_id,
      createdAt: p.created_at,
    })),
  };
}

export async function getCabinetReportSession(email, sessionId, env = process.env) {
  const supabase = getClient(env);
  const normalized = String(email ?? '').trim().toLowerCase();
  const sid = String(sessionId ?? '').trim();
  if (!supabase || !normalized || !sid) return null;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', normalized)
    .maybeSingle();
  if (userError || !user?.id) return null;

  const [assessmentRes, subscriptionRes, paymentsRes] = await Promise.all([
    supabase
      .from('assessments')
      .select('session_id, session_data, user_id')
      .eq('user_id', user.id)
      .eq('session_id', sid)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('payments')
      .select('type, status, product, session_id')
      .eq('user_id', user.id)
      .eq('status', 'paid'),
  ]);

  if (assessmentRes.error || !assessmentRes.data?.session_data) {
    return { error: 'no_report_data' };
  }

  const payments = paymentsRes.data ?? [];
  const canOpen = canOpenReportForSession(sid, subscriptionRes.data, payments);
  if (!canOpen) {
    return { error: 'payment_required' };
  }

  return {
    session: assessmentRes.data.session_data,
    sessionId: sid,
  };
}

export function getCabinetHealthInfo(env = process.env) {
  const pub = getPublicSupabaseConfig(env);
  return {
    configured: isCabinetConfigured(env),
    browserReady: Boolean(pub),
    url: '/cabinet',
    reportUrl: '/cabinet/report',
    auth: 'supabase_magic_link',
    publicConfigUrl: '/api/public-config',
  };
}
