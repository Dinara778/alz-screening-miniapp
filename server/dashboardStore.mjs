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

export async function getDashboardStats(env = process.env) {
  const supabase = getClient(env);
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (error) {
    console.error('[supabase] admin_dashboard_stats', error.message);
    return null;
  }
  return data;
}

export function getAdminDashboardHealthInfo(env = process.env) {
  return {
    configured: isAdminDashboardConfigured(env),
    url: '/admin',
    apiUrl: '/api/admin/dashboard',
  };
}
