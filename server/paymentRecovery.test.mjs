import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createResolveWebPaymentRecovery } from './paymentRecovery.mjs';

function makeDeps(overrides = {}) {
  const paid = new Map();

  const isWebPaidForSession = (sessionId, product) => {
    const key = `${sessionId}:${product}`;
    if (paid.has(key)) {
      return { paid: true, sessionId, product };
    }
    return { paid: false };
  };

  const markWebPaid = ({ sessionId, product }) => {
    paid.set(`${sessionId}:${product}`, true);
  };

  return {
    isWebPaidForSession,
    markWebPaid,
    findPaidProductPayment: async () => null,
    findActiveSubscriptionByEmail: async () => null,
    reassignPaidPaymentSession: async () => {},
    isSupabaseConfigured: () => false,
    robokassaGetOrder: () => null,
    isSubscriptionProduct: (p) => p === 'subscription_1m' || p === 'subscription_3m',
    ...overrides,
  };
}

describe('resolveWebPaymentRecovery invariants', () => {
  it('full_report paid grants report access', async () => {
    const deps = makeDeps();
    deps.isWebPaidForSession = (sid, prod) =>
      sid === 's1' && prod === 'full_report' ? { paid: true, sessionId: sid, product: prod } : { paid: false };

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({ sessionId: 's1', product: 'full_report', email: 'a@b.ru' });
    assert.equal(r.paid, true);
  });

  it('full_report paid does NOT grant subscription checkout as paid', async () => {
    const deps = makeDeps();
    deps.isWebPaidForSession = (sid, prod) =>
      sid === 's1' && prod === 'full_report' ? { paid: true, sessionId: sid, product: prod } : { paid: false };

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({ sessionId: 's1', product: 'subscription_1m', email: 'a@b.ru' });
    assert.equal(r.paid, false);
  });

  it('subscription paid grants subscription recovery', async () => {
    const deps = makeDeps();
    deps.isWebPaidForSession = (sid, prod) =>
      sid === 's1' && prod === 'subscription_1m'
        ? { paid: true, sessionId: sid, product: prod }
        : { paid: false };

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({ sessionId: 's1', product: 'subscription_1m', email: 'a@b.ru' });
    assert.equal(r.paid, true);
  });

  it('active subscription by email grants full_report for a brand-new session (retake)', async () => {
    const deps = makeDeps();
    deps.isSupabaseConfigured = () => true;
    deps.findActiveSubscriptionByEmail = async (email) =>
      email === 'sub@x.ru' ? { end_date: '2099-12-31' } : null;

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({
      sessionId: 'brand-new-session-xyz',
      product: 'full_report',
      email: 'sub@x.ru',
    });
    assert.equal(r.paid, true);
    assert.equal(r.sessionId, 'brand-new-session-xyz');
    assert.equal(r.subscriptionUntil, '2099-12-31');
  });

  it('active subscription by email grants report but not confused with one-time only', async () => {
    const deps = makeDeps();
    deps.isSupabaseConfigured = () => true;
    deps.findActiveSubscriptionByEmail = async (email) =>
      email === 'sub@x.ru' ? { end_date: '2099-12-31' } : null;

    const resolve = createResolveWebPaymentRecovery(deps);
    const report = await resolve({ sessionId: 's1', product: 'full_report', email: 'sub@x.ru' });
    assert.equal(report.paid, true);

    const sub = await resolve({ sessionId: 's1', product: 'subscription_1m', email: 'sub@x.ru' });
    assert.equal(sub.paid, true);
  });

  it('one-time full_report in supabase does not unlock subscription product query', async () => {
    const deps = makeDeps();
    deps.isSupabaseConfigured = () => true;
    deps.findPaidProductPayment = async ({ product }) =>
      product === 'full_report' ? { id: 1, session_id: 's1', external_id: 'inv1' } : null;

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({ sessionId: 's1', product: 'subscription_1m', email: 'a@b.ru' });
    assert.equal(r.paid, false);
  });

  it('subscription payment in supabase unlocks full_report via alternate path', async () => {
    const deps = makeDeps();
    deps.isSupabaseConfigured = () => true;
    deps.findPaidProductPayment = async ({ product }) =>
      product === 'subscription_1m' ? { id: 2, session_id: 's1', external_id: 'inv2' } : null;
    deps.findActiveSubscriptionByEmail = async () => ({ end_date: '2099-12-31' });

    const resolve = createResolveWebPaymentRecovery(deps);
    const r = await resolve({ sessionId: 's1', product: 'full_report', email: 'a@b.ru' });
    assert.equal(r.paid, true);
  });
});
