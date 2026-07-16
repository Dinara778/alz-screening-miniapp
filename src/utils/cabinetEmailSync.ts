import {
  clearCabinetSession,
  emailFromAccessToken,
  readCabinetSession,
} from './cabinetSessionStorage';
import { getSupabaseBrowser, resetSupabaseBrowserClient } from './supabaseBrowser';

/** Если в кабинете другая почта — выйти, чтобы в UI не светилась чужая. */
export async function syncCabinetSessionWithEmail(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalized.includes('@')) return false;

  const session = readCabinetSession();
  if (!session?.access_token) return false;

  const cabinetEmail =
    session.email?.trim().toLowerCase() || emailFromAccessToken(session.access_token);
  if (!cabinetEmail || cabinetEmail === normalized) return false;

  clearCabinetSession();
  resetSupabaseBrowserClient();
  try {
    const supabase = await getSupabaseBrowser();
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* ignore */
  }
  return true;
}
