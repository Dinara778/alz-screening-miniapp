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
      },
    });
  }
  return browserClient;
}

export function getCabinetRedirectUrl(): string {
  if (typeof window === 'undefined') return 'https://cortaapp.ru/cabinet';
  return `${window.location.origin}/cabinet`;
}
