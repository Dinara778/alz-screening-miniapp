import { useCallback, useEffect, useState } from 'react';
import { getPaymentsApiUrl } from './telegramPayments';
import {
  clearCabinetSession,
  isCabinetSessionValid,
  readCabinetSession,
} from './cabinetSessionStorage';
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

  const applyStoredSession = useCallback(() => {
    const stored = readCabinetSession();
    if (!isCabinetSessionValid(stored)) {
      if (stored) clearCabinetSession();
      return false;
    }
    setAccessToken(stored!.access_token);
    setEmail(stored!.email);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    if (applyStoredSession()) {
      setConfigured(Boolean(getPaymentsApiUrl() || (await ensureSupabaseBrowserConfig())));
      setReady(true);
      return;
    }

    const cfg = await ensureSupabaseBrowserConfig();
    setConfigured(Boolean(cfg || getPaymentsApiUrl()));
    if (!cfg && !getPaymentsApiUrl()) {
      setReady(true);
      return;
    }

    if (hasAuthParamsInUrl()) {
      try {
        await completeCabinetAuthFromUrl();
      } catch {
        // Magic-link в браузере может быть недоступен — OTP-сессия хранится локально.
      }
      if (applyStoredSession()) {
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
  }, [applyStoredSession]);

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
