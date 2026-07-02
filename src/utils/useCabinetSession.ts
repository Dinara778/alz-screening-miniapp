import { useCallback, useEffect, useState } from 'react';
import { ensureSupabaseBrowserConfig, getSupabaseBrowser } from './supabaseBrowser';

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
