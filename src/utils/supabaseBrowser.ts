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
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return browserClient;
}

export function resetSupabaseBrowserClient(): void {
  browserClient = null;
}

export function peekCabinetAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (fromQuery) return decodeURIComponent(fromQuery.replace(/\+/g, ' '));

  const hash = url.hash?.replace(/^#/, '') ?? '';
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash);
  const fromHash = hashParams.get('error_description') || hashParams.get('error');
  return fromHash ? decodeURIComponent(fromHash.replace(/\+/g, ' ')) : null;
}

/** Обработка возврата по magic-link (?code=, ?token_hash=, #access_token) без поломки SPA. */
export async function completeCabinetAuthFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const supabase = await getSupabaseBrowser();
  const url = new URL(window.location.href);

  if (peekCabinetAuthErrorFromUrl()) {
    stripCabinetAuthParamsFromUrl();
    return false;
  }

  const tokenHash = url.searchParams.get('token_hash')?.trim();
  const otpType = url.searchParams.get('type')?.trim();
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    });
    stripCabinetAuthParamsFromUrl();
    return !error;
  }

  const code = url.searchParams.get('code')?.trim();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    stripCabinetAuthParamsFromUrl();
    return !error;
  }

  const hash = url.hash?.replace(/^#/, '') ?? '';
  if (hash.includes('access_token=')) {
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token')?.trim();
    const refreshToken = hashParams.get('refresh_token')?.trim();
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      stripCabinetAuthParamsFromUrl();
      return !error;
    }
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
