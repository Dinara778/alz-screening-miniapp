/**
 * Метрики админ-дашборда из Supabase.
 */
import { getClient, isSupabaseConfigured } from './supabaseStore.mjs';

export function isAdminDashboardConfigured(env = process.env) {
  return Boolean(isSupabaseConfigured(env) && env.ADMIN_DASHBOARD_PASSWORD?.trim());
}

export function verifyAdminPassword(provided, env = process.env) {
  const expected = env.ADMIN_DASHBOARD_PASSWORD?.trim();
  if (!expected || !provided) return false;
  const value = String(provided).trim();
  if (value.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ value.charCodeAt(i);
  }
  return mismatch === 0;
}

export function extractAdminPassword(req) {
  const auth = req.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  if (typeof req.query?.password === 'string') return req.query.password.trim();
  if (typeof req.body?.password === 'string') return req.body.password.trim();
  return null;
}

function getMoscowDayStartIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}T00:00:00+03:00`;
}

function uniqueUserIds(rows) {
  return new Set((rows ?? []).map((r) => r.user_id).filter(Boolean));
}

function countReturnedUsers(assessmentRows) {
  const perUser = new Map();
  for (const row of assessmentRows ?? []) {
    if (!row.user_id) continue;
    perUser.set(row.user_id, (perUser.get(row.user_id) ?? 0) + 1);
  }
  let returned = 0;
  for (const count of perUser.values()) {
    if (count >= 2) returned += 1;
  }
  return returned;
}

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((1000 * numerator) / denominator) / 10;
}

function buildDashboardPayload({
  usersNewToday,
  usersTotal,
  payments,
  funnelUserIds,
  assessmentUserIds,
  paidWithTestUserIds,
  paidUserIds,
  subUserIds,
  testsToday,
  returnedUsers,
}) {
  const funnelCount = funnelUserIds.size;
  const testCount = assessmentUserIds.size;
  const paidCount = paidUserIds.size;
  const subCount = subUserIds.size;
  const paidWithTestCount = paidWithTestUserIds.size;

  let oneTimeRub = 0;
  let subscriptionRub = 0;
  for (const p of payments ?? []) {
    const amount = Number(p.amount);
    if (!Number.isFinite(amount)) continue;
    if (p.type === 'one_time') oneTimeRub += amount;
    if (p.type === 'subscription') subscriptionRub += amount;
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Europe/Moscow',
    users: {
      newToday: usersNewToday,
      total: usersTotal,
    },
    revenue: {
      oneTimeRub,
      subscriptionRub,
    },
    conversions: {
      visitedToTest: {
        numerator: testCount,
        denominator: funnelCount,
        percent: pct(testCount, funnelCount),
      },
      testToPurchase: {
        numerator: paidWithTestCount,
        denominator: testCount,
        percent: pct(paidWithTestCount, testCount),
      },
      purchaseToSubscription: {
        numerator: subCount,
        denominator: paidCount,
        percent: pct(subCount, paidCount),
      },
    },
    activity: {
      testsToday,
      returnedUsers,
    },
  };
}

async function fetchTableRows(supabase, table, select) {
  const { data, error } = await supabase.from(table).select(select);
  if (error) {
    console.warn(`[supabase] dashboard skip ${table}:`, error.message);
    return [];
  }
  return data ?? [];
}

async function fetchDashboardStatsDirect(supabase) {
  const dayStart = getMoscowDayStartIso();

  const [usersNewRes, usersTotalRes, paymentsRes, assessmentsRes, assessmentsTodayRes, subsRes, funnelRows] =
    await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('user_id, type, amount').eq('status', 'paid'),
      supabase.from('assessments').select('user_id'),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
      supabase.from('subscriptions').select('user_id').eq('status', 'active'),
      fetchTableRows(supabase, 'funnel_sessions', 'user_id'),
    ]);

  const firstError =
    usersNewRes.error ||
    usersTotalRes.error ||
    paymentsRes.error ||
    assessmentsRes.error ||
    assessmentsTodayRes.error ||
    subsRes.error;

  if (firstError) {
    console.error('[supabase] dashboard direct', firstError.message);
    return null;
  }

  const assessmentUserIds = uniqueUserIds(assessmentsRes.data);
  const paidUserIds = uniqueUserIds(
    (paymentsRes.data ?? []).filter((p) => p.type === 'one_time'),
  );
  const paidWithTestUserIds = new Set(
    [...paidUserIds].filter((id) => assessmentUserIds.has(id)),
  );

  return buildDashboardPayload({
    usersNewToday: usersNewRes.count ?? 0,
    usersTotal: usersTotalRes.count ?? 0,
    payments: paymentsRes.data,
    funnelUserIds: uniqueUserIds(funnelRows),
    assessmentUserIds,
    paidWithTestUserIds,
    paidUserIds,
    subUserIds: uniqueUserIds(subsRes.data),
    testsToday: assessmentsTodayRes.count ?? 0,
    returnedUsers: countReturnedUsers(assessmentsRes.data),
  });
}

export async function getDashboardStats(env = process.env) {
  const supabase = getClient(env);
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (!error && data) return data;

  if (error) {
    console.warn('[supabase] admin_dashboard_stats rpc unavailable, using direct queries:', error.message);
  }

  return fetchDashboardStatsDirect(supabase);
}

export function getAdminDashboardHealthInfo(env = process.env) {
  return {
    configured: isAdminDashboardConfigured(env),
    url: '/admin',
    apiUrl: '/api/admin/dashboard',
  };
}
