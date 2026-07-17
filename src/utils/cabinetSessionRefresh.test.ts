import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('./telegramPayments', () => ({
  getPaymentsApiUrl: () => 'https://api.test',
}));

import { ensureFreshCabinetSession } from './cabinetSessionRefresh';
import { readCabinetSession, saveCabinetSession } from './cabinetSessionStorage';

function expiredAccessToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) - 60,
      email: 'user@example.com',
    }),
  );
  return `${header}.${payload}.sig`;
}

describe('ensureFreshCabinetSession', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('keeps session on transient refresh failure', async () => {
    saveCabinetSession(
      { access_token: expiredAccessToken(), refresh_token: 'refresh-a' },
      'user@example.com',
    );

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'supabase_unreachable' }), {
        status: 502,
      }),
    );

    const session = await ensureFreshCabinetSession();

    expect(session?.email).toBe('user@example.com');
    expect(readCabinetSession()?.refresh_token).toBe('refresh-a');
  });

  it('clears session only on auth failure', async () => {
    saveCabinetSession(
      { access_token: expiredAccessToken(), refresh_token: 'refresh-a' },
      'user@example.com',
    );

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'invalid_refresh' }), {
        status: 401,
      }),
    );

    const session = await ensureFreshCabinetSession();

    expect(session).toBeNull();
    expect(readCabinetSession()).toBeNull();
  });

  it('returns fresh session without network when access token is valid', async () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'user@example.com',
      }),
    );
    const freshToken = `${header}.${payload}.sig`;

    saveCabinetSession(
      { access_token: freshToken, refresh_token: 'refresh-a' },
      'user@example.com',
    );

    const session = await ensureFreshCabinetSession();

    expect(session?.access_token).toBe(freshToken);
    expect(fetch).not.toHaveBeenCalled();
  });
});
