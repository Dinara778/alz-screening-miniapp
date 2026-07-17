import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    },
  });
});

const signOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const resetSupabaseBrowserClient = vi.hoisted(() => vi.fn());

vi.mock('./supabaseBrowser', () => ({
  getSupabaseBrowser: vi.fn().mockResolvedValue({
    auth: { signOut },
  }),
  resetSupabaseBrowserClient: () => resetSupabaseBrowserClient(),
}));

import { syncCabinetSessionWithEmail } from './cabinetEmailSync';
import { readCabinetSession, saveCabinetSession } from './cabinetSessionStorage';

describe('syncCabinetSessionWithEmail', () => {
  beforeEach(() => {
    storage.clear();
    signOut.mockClear();
    resetSupabaseBrowserClient.mockClear();
  });

  it('keeps session when assessment email matches cabinet', async () => {
    saveCabinetSession(
      { access_token: 'token-a', refresh_token: 'refresh-a' },
      'user@example.com',
    );

    const signedOut = await syncCabinetSessionWithEmail('user@example.com');

    expect(signedOut).toBe(false);
    expect(readCabinetSession()?.email).toBe('user@example.com');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('keeps session when emails differ only by case', async () => {
    saveCabinetSession(
      { access_token: 'token-a', refresh_token: 'refresh-a' },
      'User@Example.com',
    );

    const signedOut = await syncCabinetSessionWithEmail('user@example.com');

    expect(signedOut).toBe(false);
    expect(readCabinetSession()).not.toBeNull();
  });

  it('signs out when assessment email differs from cabinet', async () => {
    saveCabinetSession(
      { access_token: 'token-a', refresh_token: 'refresh-a' },
      'other@example.com',
    );

    const signedOut = await syncCabinetSessionWithEmail('user@example.com');

    expect(signedOut).toBe(true);
    expect(readCabinetSession()).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does nothing without a cabinet session', async () => {
    const signedOut = await syncCabinetSessionWithEmail('user@example.com');
    expect(signedOut).toBe(false);
  });
});
