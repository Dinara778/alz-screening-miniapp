/**
 * Личный кабинет: проверка JWT Supabase Auth и данные пользователя.
 */
import {
  cancelSubscription,
  getClient,
  getPublicSupabaseConfig,
  isSupabaseConfigured,
  upsertUserByEmail,
  userHasSubscriptionRecord,
} from './supabaseStore.mjs';

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

function isSubscriptionAccessActive(subscription) {
  if (!subscription?.end_date) return subscription?.status === 'active';
  const end = new Date(`${subscription.end_date}T23:59:59`);
  return Number.isFinite(end.getTime()) && end >= new Date() && subscription.status !== 'inactive';
}

function isSubscriptionPayment(p) {
  return (
    p.type === 'subscription' ||
    p.product === 'subscription_1m' ||
    p.product === 'subscription_3m'
  );
}

function filterCabinetPayments(payments, hasSubscriptionRecord) {
  return (payments ?? []).filter((p) => {
    if (isSubscriptionPayment(p)) return hasSubscriptionRecord;
    return true;
  });
}

/** Убрать дубли (Result URL + Success URL / гонка insert). */
function dedupeCabinetPayments(payments) {
  const seen = new Set();
  const out = [];
  for (const p of payments ?? []) {
    const ext = String(p.external_id ?? '').trim();
    const key = ext
      ? `ext:${ext}`
      : `fuzzy:${p.product ?? ''}|${Number(p.amount)}|${String(p.created_at ?? '').slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function subscriptionPlanLabel(payments) {
  const subPayment = (payments ?? []).find((p) => isSubscriptionPayment(p) && p.status === 'paid');
  if (subPayment?.product === 'subscription_3m') return 'Подписка «Corta» — 3 месяца';
  if (subPayment?.product === 'subscription_1m') return 'Подписка Corta — 1 месяц';
  return 'Подписка Corta';
}

function resolveAccessType(subscription, payments) {
  if (subscription && isSubscriptionAccessActive(subscription)) {
    return {
      type: 'subscription',
      label: subscriptionPlanLabel(payments),
      endDate: subscription.end_date ?? null,
    };
  }
  const hasOneTime = (payments ?? []).some(
    (p) => p.type === 'one_time' && p.status === 'paid' && p.product === 'full_report',
  );
  if (hasOneTime) {
    return {
      type: 'one_time',
      label: 'Разовый разбор',
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
  if (subscription && isSubscriptionAccessActive(subscription)) return true;
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

function participantFromSessionData(sessionData) {
  if (!sessionData || typeof sessionData !== 'object') return null;
  const p = sessionData.participant;
  if (!p || typeof p !== 'object') return null;

  const email = String(p.email ?? '')
    .trim()
    .toLowerCase();
  if (!email.includes('@')) return null;

  const age = Number(p.age);
  if (!Number.isFinite(age) || age < 18 || age > 100) return null;

  const sex = p.sex === 'Мужской' ? 'Мужской' : p.sex === 'Женский' ? 'Женский' : null;
  if (!sex) return null;

  return {
    name: String(p.name ?? '').trim(),
    email,
    phone: String(p.phone ?? 'Не указано'),
    sex,
    age,
    education: String(p.education ?? 'Не указано'),
    educationYears: Number(p.educationYears) > 0 ? Number(p.educationYears) : 12,
    pcConfidence: [1, 2, 3, 4, 5].includes(Number(p.pcConfidence))
      ? Number(p.pcConfidence)
      : 3,
  };
}

async function loadParticipantProfileForUser(supabase, userId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('session_data')
    .eq('user_id', userId)
    .not('session_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('[cabinet] participant profile', error.message);
    return null;
  }

  for (const row of data ?? []) {
    const profile = participantFromSessionData(row.session_data);
    if (profile) return profile;
  }
  return null;
}

export async function getCabinetParticipantProfile(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!supabase || !normalized) return null;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (userError) {
    console.error('[cabinet] participant profile user', userError.message);
    return null;
  }
  if (!user?.id) return null;

  return loadParticipantProfileForUser(supabase, user.id);
}

async function loadCurrentSubscription(supabase, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status, start_date, end_date')
    .eq('user_id', userId)
    .gte('end_date', today)
    .neq('status', 'inactive')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[cabinet] subscription', error.message);
    return null;
  }
  return data;
}

export async function getCabinetData(email, env = process.env) {
  const supabase = getClient(env);
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!supabase || !normalized) return null;

  const user = await upsertUserByEmail(normalized, env);
  if (!user) return null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [history7dRes, historyAllRes, paymentsRes] = await Promise.all([
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

  const hasSubscriptionRecord = await userHasSubscriptionRecord({ userId: user.id }, env);
  const payments = dedupeCabinetPayments(
    filterCabinetPayments(paymentsRes.data ?? [], hasSubscriptionRecord),
  );
  const subscription = await loadCurrentSubscription(supabase, user.id);
  const history7d = enrichAssessments(history7dRes.data, subscription, payments);
  const historyAll = enrichAssessments(historyAllRes.data, subscription, payments);
  const latest = history7d[0] ?? historyAll[0] ?? null;

  const subscriptionInfo =
    subscription && isSubscriptionAccessActive(subscription)
      ? {
          planLabel: subscriptionPlanLabel(payments),
          status: subscription.status,
          endDate: subscription.end_date,
          canCancel: subscription.status === 'active',
        }
      : null;

  return {
    email: user.email,
    latest,
    history7d,
    history: history7d,
    historyAll,
    compensationTip: latest?.compensationTip ?? null,
    access: resolveAccessType(subscription, payments),
    subscription: subscriptionInfo,
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

export async function cancelCabinetSubscription(email, env = process.env) {
  return cancelSubscription(email, env);
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

  const [assessmentRes, paymentsRes] = await Promise.all([
    supabase
      .from('assessments')
      .select('session_id, session_data, user_id')
      .eq('user_id', user.id)
      .eq('session_id', sid)
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

  const hasSubscriptionRecord = await userHasSubscriptionRecord({ userId: user.id }, env);
  const payments = dedupeCabinetPayments(
    filterCabinetPayments(paymentsRes.data ?? [], hasSubscriptionRecord),
  );
  const subscription = await loadCurrentSubscription(supabase, user.id);
  const canOpen = canOpenReportForSession(sid, subscription, payments);
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
    auth: 'supabase_email_otp',
    publicConfigUrl: '/api/public-config',
  };
}
