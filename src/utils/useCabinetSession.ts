import { useCallback, useEffect, useState } from 'react';
import { getPaymentsApiUrl } from './telegramPayments';
import {
  clearCabinetSession,
  hasCabinetSessionTokens,
  readCabinetSession,
} from './cabinetSessionStorage';
import { ensureFreshCabinetSession } from './cabinetSessionRefresh';
import { ensureSupabaseBrowserConfig, completeCabinetAuthFromUrl, getSupabaseBrowser } from './supabaseBrowser';

function hasAuthParamsInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('token_hash')) return true;
  return url.hash.includes('access_token=');
}

export function useCabinetSession() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const applySession = useCallback((session: { access_token: string; email: string | null }) => {
    setAccessToken(session.access_token);
    setEmail(session.email);
  }, []);

  const refresh = useCallback(async () => {
    setConfigured(Boolean(getPaymentsApiUrl() || (await ensureSupabaseBrowserConfig())));

    const stored = readCabinetSession();
    if (hasCabinetSessionTokens(stored)) {
      const fresh = await ensureFreshCabinetSession();
      if (fresh) {
        applySession(fresh);
        setReady(true);
        return;
      }
      // refresh неудачен — только тогда считаем вылогиненным
      clearCabinetSession();
    }

    if (hasAuthParamsInUrl()) {
      try {
        await completeCabinetAuthFromUrl();
      } catch {
        /* magic-link optional */
      }
      const afterUrl = await ensureFreshCabinetSession();
      if (afterUrl) {
        applySession(afterUrl);
        setReady(true);
        return;
      }
    }

    try {
      const supabase = await getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        setAccessToken(data.session.access_token);
        setEmail(data.session.user?.email?.toLowerCase() ?? null);
      } else {
        setAccessToken(null);
        setEmail(null);
      }
    } catch {
      setAccessToken(null);
      setEmail(null);
    }
    setReady(true);
  }, [applySession]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      await refresh();
      try {
        const cfg = await ensureSupabaseBrowserConfig();
        if (!cfg) return;
        const supabase = await getSupabaseBrowser();
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            setAccessToken(session.access_token);
            setEmail(session.user?.email?.toLowerCase() ?? null);
          }
          setReady(true);
        });
        unsub = () => sub.subscription.unsubscribe();
      } catch {
        // OTP-вход не требует live-подключения к Supabase в браузере.
      }
    })();
    return () => unsub?.();
  }, [refresh]);

  return { accessToken, email, ready, configured, refresh };
}
