import { describe, expect, it, vi } from 'vitest';

describe('paymentStub prod gating', () => {
  it('arePaymentsActive on prod host even when VITE_PAYMENTS_ENABLED=false', async () => {
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_PAYMENTS_ENABLED', 'false');
    vi.stubEnv('VITE_DEV_BYPASS_REPORT_PAYMENT', 'true');
    vi.stubGlobal('window', { location: { href: 'https://corta-ns-1234dinara.amvera.io/' } });

    const { arePaymentsActive, isDevPaymentBypass, shouldBypassReportPayment } = await import(
      './paymentStub'
    );

    expect(isDevPaymentBypass()).toBe(false);
    expect(arePaymentsActive(true)).toBe(true);
    expect(shouldBypassReportPayment(true)).toBe(false);
  });
});
