import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPaymentsApiUrl } from './telegramPayments';

type SupabasePublicConfig = { url: string; anonKey: string };

let browserClient: SupabaseClient | null = null;
let runtimeConfig: SupabasePublicConfig | null | undefined;

function getBuildConfig(): SupabasePublicConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (url && anon) return { url, anonKey: anon };
  return null;
}

/** Ключи из сборки или GET /api/public-config (Amvera «Запуск»: SUPABASE_ANON_KEY). */
export async function ensureSupabaseBrowserConfig(): Promise<SupabasePublicConfig | null> {
  const build = getBuildConfig();
  if (build) return build;
  if (runtimeConfig !== undefined) return runtimeConfig;

  const api = getPaymentsApiUrl();
  if (!api) {
    runtimeConfig = null;
    return null;
  }

  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/api/public-config`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.supabaseUrl && json.supabaseAnonKey) {
      runtimeConfig = {
        url: String(json.supabaseUrl).trim(),
        anonKey: String(json.supabaseAnonKey).trim(),
      };
    } else {
      runtimeConfig = null;
    }
  } catch {
    runtimeConfig = null;
  }
  return runtimeConfig;
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(getBuildConfig());
}

export async function isSupabaseBrowserConfiguredAsync(): Promise<boolean> {
  return Boolean(await ensureSupabaseBrowserConfig());
}

export async function getSupabaseBrowser(): Promise<SupabaseClient> {
  const cfg = await ensureSupabaseBrowserConfig();
  if (!cfg) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not configured');
  }
  if (!browserClient) {
    browserClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return browserClient;
}

/** Обработка возврата по старой magic-link (?code= / #access_token) без поломки SPA. */
export async function completeCabinetAuthFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const supabase = await getSupabaseBrowser();
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code')?.trim();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    stripCabinetAuthParamsFromUrl();
    return !error;
  }

  const hash = window.location.hash?.replace(/^#/, '') ?? '';
  if (hash.includes('access_token=') || hash.includes('error=')) {
    const { data, error } = await supabase.auth.getSession();
    stripCabinetAuthParamsFromUrl();
    return !error && Boolean(data.session);
  }

  return false;
}

function stripCabinetAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('type');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.hash = '';
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState({}, '', next || url.pathname);
}

export function getCabinetRedirectUrl(): string {
  if (typeof window === 'undefined') return 'https://cortaapp.ru/cabinet';
  return `${window.location.origin}/cabinet`;
}
