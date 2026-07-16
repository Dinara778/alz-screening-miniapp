/**
 * Метрики админ-дашборда из Supabase.
 * Все периоды (сегодня / 7д / 30д / всё) считаются одним путём — прямыми запросами с фильтром даты.
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

export function parseDashboardPeriod(raw) {
  const period = String(raw ?? 'today').trim().toLowerCase();
  if (period === '7d' || period === '30d' || period === 'all' || period === 'today') return period;
  return 'today';
}

export function getPeriodLabel(period) {
  if (period === 'today') return 'сегодня';
  if (period === '7d') return '7 дней';
  if (period === '30d') return '30 дней';
  return 'всё время';
}

function getMoscowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    y: parts.find((p) => p.type === 'year')?.value ?? '1970',
    m: parts.find((p) => p.type === 'month')?.value ?? '01',
    d: parts.find((p) => p.type === 'day')?.value ?? '01',
  };
}

function getMoscowDayStartIso(date = new Date()) {
  const { y, m, d } = getMoscowParts(date);
  return `${y}-${m}-${d}T00:00:00+03:00`;
}

export function getPeriodStartIso(period) {
  if (period === 'all') return null;
  if (period === 'today') return getMoscowDayStartIso();

  const days = period === '7d' ? 7 : 30;
  // Якорь — полночь МСК сегодня; минус (days-1) календарных суток МСК.
  const anchor = new Date(getMoscowDayStartIso());
  anchor.setUTCDate(anchor.getUTCDate() - (days - 1));
  return anchor.toISOString();
}

function uniqueUserIds(rows) {
  return new Set((rows ?? []).map((r) => r.user_id).filter(Boolean));
}

function filterByPeriod(rows, periodStart, field = 'created_at') {
  if (!periodStart) return rows ?? [];
  const start = new Date(periodStart).getTime();
  return (rows ?? []).filter((row) => {
    const ts = new Date(row[field] ?? 0).getTime();
    return Number.isFinite(ts) && ts >= start;
  });
}

function maxCreatedAt(rows) {
  let max = null;
  for (const row of rows ?? []) {
    const ts = new Date(row?.created_at ?? 0).getTime();
    if (!Number.isFinite(ts)) continue;
    if (max == null || ts > max) max = ts;
  }
  return max == null ? null : new Date(max).toISOString();
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

function isPaidPurchase(row) {
  return row?.status === 'paid' && (row.type === 'one_time' || row.type === 'subscription');
}

function buildDashboardPayload({
  period,
  usersNewInPeriod,
  usersTotal,
  payments,
  funnelUserIds,
  assessmentUserIds,
  paidWithTestUserIds,
  paidUserIds,
  subUserIds,
  testsInPeriod,
  returnedUsers,
  paymentsTotalInDb,
  assessmentsTotalInDb,
  debug = null,
}) {
  const funnelCount = funnelUserIds.size;
  const testCount = assessmentUserIds.size;
  const paidCount = paidUserIds.size;
  const subCount = subUserIds.size;
  const paidWithTestCount = paidWithTestUserIds.size;

  let oneTimeRub = 0;
  let subscriptionRub = 0;
  let oneTimeCount = 0;
  let subscriptionCount = 0;
  for (const p of payments ?? []) {
    const amount = Number(p.amount);
    if (p.type === 'one_time') {
      oneTimeCount += 1;
      if (Number.isFinite(amount)) oneTimeRub += amount;
    }
    if (p.type === 'subscription') {
      subscriptionCount += 1;
      if (Number.isFinite(amount)) subscriptionRub += amount;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Europe/Moscow',
    period,
    periodLabel: getPeriodLabel(period),
    periodStart: debug?.periodStart ?? null,
    users: {
      newInPeriod: usersNewInPeriod,
      total: usersTotal,
    },
    revenue: {
      oneTimeRub,
      subscriptionRub,
    },
    payments: {
      inPeriod: oneTimeCount + subscriptionCount,
      oneTime: oneTimeCount,
      subscription: subscriptionCount,
      totalInDb: paymentsTotalInDb,
      latestInDb: debug?.latestPaymentAt ?? null,
    },
    assessments: {
      inPeriod: testsInPeriod,
      totalInDb: assessmentsTotalInDb,
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
      testsInPeriod,
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

async function fetchDashboardStatsDirect(supabase, period = 'today') {
  const periodStart = getPeriodStartIso(period);

  const [usersRes, paymentsRes, assessmentsRes, funnelRows] = await Promise.all([
    supabase.from('users').select('id, created_at'),
    supabase.from('payments').select('user_id, type, amount, created_at, status').eq('status', 'paid'),
    supabase.from('assessments').select('user_id, created_at'),
    fetchTableRows(supabase, 'funnel_sessions', 'user_id, created_at'),
  ]);

  const firstError = usersRes.error || paymentsRes.error || assessmentsRes.error;

  if (firstError) {
    console.error('[supabase] dashboard direct', firstError.message);
    return null;
  }

  const allPayments = (paymentsRes.data ?? []).filter(isPaidPurchase);
  const usersInPeriod = filterByPeriod(usersRes.data, periodStart);
  const paymentsInPeriod = filterByPeriod(allPayments, periodStart);
  const assessmentsInPeriod = filterByPeriod(assessmentsRes.data, periodStart);
  const funnelInPeriod = filterByPeriod(funnelRows, periodStart);

  const assessmentUserIds = uniqueUserIds(assessmentsInPeriod);
  const paidUserIds = uniqueUserIds(paymentsInPeriod);
  const subUserIds = uniqueUserIds(paymentsInPeriod.filter((p) => p.type === 'subscription'));
  const paidWithTestUserIds = new Set([...paidUserIds].filter((id) => assessmentUserIds.has(id)));

  return buildDashboardPayload({
    period,
    usersNewInPeriod: usersInPeriod.length,
    usersTotal: usersRes.data?.length ?? 0,
    payments: paymentsInPeriod,
    funnelUserIds: uniqueUserIds(funnelInPeriod),
    assessmentUserIds,
    paidWithTestUserIds,
    paidUserIds,
    subUserIds,
    testsInPeriod: assessmentsInPeriod.length,
    returnedUsers: countReturnedUsers(assessmentsInPeriod),
    paymentsTotalInDb: allPayments.length,
    assessmentsTotalInDb: assessmentsRes.data?.length ?? 0,
    debug: {
      periodStart,
      latestPaymentAt: maxCreatedAt(allPayments),
    },
  });
}

export async function getDashboardStats(period = 'today', env = process.env) {
  const supabase = getClient(env);
  if (!supabase) return null;
  // Один путь для всех периодов — иначе «сегодня» (RPC) расходился с Supabase и с 7д/30д.
  return fetchDashboardStatsDirect(supabase, period);
}

export function getAdminDashboardHealthInfo(env = process.env) {
  return {
    configured: isAdminDashboardConfigured(env),
    url: '/admin',
    apiUrl: '/api/admin/dashboard',
    importApiUrl: '/api/admin/import-sheets-csv',
  };
}
