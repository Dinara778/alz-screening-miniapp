import { useCallback, useEffect, useState } from 'react';
import { getPaymentsApiUrl } from './telegramPayments';
import {
  ensureSupabaseBrowserConfig,
  getCabinetRedirectUrl,
  getSupabaseBrowser,
} from './supabaseBrowser';

export type CabinetAssessment = {
  sessionId: string;
  score: number;
  memoryScore: number;
  attentionScore: number;
  speedScore: number;
  stabilityScore: number | null;
  flexibilityScore: number | null;
  compensationTip: string | null;
  createdAt: string;
};

export type CabinetData = {
  email: string;
  latest: CabinetAssessment | null;
  history: CabinetAssessment[];
  compensationTip: string | null;
  access: {
    type: 'subscription' | 'one_time' | 'free';
    label: string;
    endDate: string | null;
  };
};

export async function fetchCabinetData(accessToken: string): Promise<CabinetData> {
  const api = getPaymentsApiUrl();
  if (!api) throw new Error('API не настроен');
  const res = await fetch(`${api.replace(/\/$/, '')}/api/cabinet/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Не удалось загрузить кабинет');
  }
  return json.data as CabinetData;
}

export async function requestMagicLink(email: string): Promise<void> {
  const supabase = await getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: getCabinetRedirectUrl(),
    },
  });
  if (error) throw error;
}

export async function signOutCabinet(): Promise<void> {
  const supabase = await getSupabaseBrowser();
  await supabase.auth.signOut();
}

export function useCabinetSession() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const cfg = await ensureSupabaseBrowserConfig();
    setConfigured(Boolean(cfg));
    if (!cfg) {
      setReady(true);
      return;
    }
    const supabase = await getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    setAccessToken(data.session?.access_token ?? null);
    setEmail(data.session?.user?.email?.toLowerCase() ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      await refresh();
      const cfg = await ensureSupabaseBrowserConfig();
      if (!cfg) return;
      const supabase = await getSupabaseBrowser();
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setAccessToken(session?.access_token ?? null);
        setEmail(session?.user?.email?.toLowerCase() ?? null);
        setReady(true);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub?.();
  }, [refresh]);

  return { accessToken, email, ready, configured, refresh };
}
