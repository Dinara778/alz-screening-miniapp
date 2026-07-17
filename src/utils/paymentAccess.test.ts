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

vi.mock('./runtime', () => ({
  isStandaloneWeb: () => true,
}));

vi.mock('./webPayments', () => ({
  confirmWebReportAccess: vi.fn(),
  confirmWebSubscriptionAccess: vi.fn(),
  syncSubscriptionAccessFromServer: vi.fn(),
}));

vi.mock('./telegramPayments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./telegramPayments')>();
  return {
    ...actual,
    verifyReportPaymentOnServer: vi.fn(),
  };
});

import {
  alreadyPaidCheckoutCopy,
  confirmProductPaid,
  confirmReportAccess,
  denyReportAccess,
  grantReportAccess,
  isReportPaidLocal,
  reportPaidStorageKey,
} from './paymentAccess';
import { confirmWebReportAccess, confirmWebSubscriptionAccess } from './webPayments';

describe('paymentAccess invariants', () => {
  beforeEach(() => {
    storage.clear();
    vi.mocked(confirmWebReportAccess).mockReset();
    vi.mocked(confirmWebSubscriptionAccess).mockReset();
  });

  it('report unlock is per sessionId in local cache', () => {
    grantReportAccess('paid-session');
    expect(isReportPaidLocal('new-session', true)).toBe(false);
    expect(isReportPaidLocal('paid-session', true)).toBe(true);
  });

  it('subscription localStorage alone does not unlock report local flag', () => {
    localStorage.setItem('corta_subscription_until', '2099-12-31');
    localStorage.setItem('corta_subscription_server_ok', '1');
    localStorage.setItem('corta_subscription_email', 'sub@example.com');
    expect(isReportPaidLocal('new-session', true)).toBe(false);
  });

  it('denyReportAccess clears stale cache', () => {
    grantReportAccess('s1');
    denyReportAccess('s1');
    expect(localStorage.getItem(reportPaidStorageKey('s1'))).toBeNull();
  });

  it('confirmReportAccess clears cache when server denies', async () => {
    grantReportAccess('s1');
    vi.mocked(confirmWebReportAccess).mockResolvedValue(false);
    const ok = await confirmReportAccess({
      sessionId: 's1',
      payerEmail: 'a@b.ru',
      serverPaymentsReady: true,
    });
    expect(ok).toBe(false);
    expect(localStorage.getItem(reportPaidStorageKey('s1'))).toBeNull();
  });

  it('confirmProductPaid uses report path for full_report', async () => {
    vi.mocked(confirmWebReportAccess).mockResolvedValue(true);
    const ok = await confirmProductPaid({
      sessionId: 's1',
      product: 'full_report',
      payerEmail: 'a@b.ru',
      serverPaymentsReady: true,
    });
    expect(ok).toBe(true);
    expect(confirmWebReportAccess).toHaveBeenCalled();
    expect(confirmWebSubscriptionAccess).not.toHaveBeenCalled();
  });

  it('confirmProductPaid uses subscription path for subscription_1m', async () => {
    vi.mocked(confirmWebSubscriptionAccess).mockResolvedValue(false);
    const ok = await confirmProductPaid({
      sessionId: 's1',
      product: 'subscription_1m',
      payerEmail: 'a@b.ru',
      serverPaymentsReady: true,
    });
    expect(ok).toBe(false);
    expect(confirmWebSubscriptionAccess).toHaveBeenCalledWith(
      's1',
      'subscription_1m',
      'a@b.ru',
      true,
    );
    expect(confirmWebReportAccess).not.toHaveBeenCalled();
  });

  it('alreadyPaidCheckoutCopy differs for report vs subscription', () => {
    const report = alreadyPaidCheckoutCopy('full_report');
    const sub = alreadyPaidCheckoutCopy('subscription_1m');
    expect(report?.title).toContain('Доступ');
    expect(sub?.title).toContain('Подписка');
    expect(report?.cta).not.toBe(sub?.cta);
  });
});
