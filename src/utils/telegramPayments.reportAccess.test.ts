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

import {
  isReportPaidLocal,
  reportPaidStorageKey,
} from './paymentAccess';
import {
  getPaidReportSessionId,
  verifyReportPaymentOnServer,
} from './telegramPayments';

describe('report access', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('getPaidReportSessionId finds other paid session; unlock is per session', () => {
    localStorage.setItem(reportPaidStorageKey('paid-session'), '1');
    expect(getPaidReportSessionId('new-session')).toBe('paid-session');
    expect(isReportPaidLocal('new-session', true)).toBe(false);
    expect(isReportPaidLocal('paid-session', true)).toBe(true);
  });

  it('prefers exact session match', () => {
    localStorage.setItem(reportPaidStorageKey('a'), '1');
    localStorage.setItem(reportPaidStorageKey('b'), '1');
    expect(getPaidReportSessionId('b')).toBe('b');
  });

  it('active subscription cache alone does not unlock a new session', () => {
    localStorage.setItem('corta_subscription_until', '2099-12-31');
    localStorage.setItem('corta_subscription_server_ok', '1');
    localStorage.setItem('corta_subscription_email', 'sub@example.com');
    expect(isReportPaidLocal('new-session', true)).toBe(false);
  });

  it('verifyReportPaymentOnServer ignores stale paid flag for another session', async () => {
    localStorage.setItem(reportPaidStorageKey('old-session'), '1');
    vi.stubGlobal('window', {
      Telegram: { WebApp: { initData: 'test-init' } },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ paid: false }),
    }));

    const r = await verifyReportPaymentOnServer('new-session');
    expect(r.ok).toBe(false);
  });
});
