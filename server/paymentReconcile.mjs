/**
 * Авто-сверка оплат Робокассы → Supabase (дашборд без ручного ввода).
 */
import { listRecentRobokassaInvIdProbes, listRobokassaOrders } from './robokassa.mjs';
import { fetchRobokassaOpState } from './robokassaOpState.mjs';
import {
  findPaidExternalIds,
  listPaymentsForRobokassaReconcile,
} from './supabaseStore.mjs';

let reconcileInFlight = null;
let lastReconcileAt = 0;

/**
 * @param {{ fulfillPaidOrder: Function }} deps
 */
export async function reconcileRobokassaPayments(deps, env = process.env) {
  const now = Date.now();
  if (now - lastReconcileAt < 45_000 && !reconcileInFlight) {
    return { checked: 0, fulfilled: 0, skipped: true };
  }
  if (reconcileInFlight) return reconcileInFlight;

  reconcileInFlight = (async () => {
    const fulfillPaidOrder = deps?.fulfillPaidOrder;
    if (typeof fulfillPaidOrder !== 'function') {
      return { checked: 0, fulfilled: 0, error: 'no_fulfill' };
    }

    const dbRows = await listPaymentsForRobokassaReconcile(env);
    const localOrders = listRobokassaOrders();

    /** @type {Map<string, { invId: string, sessionId?: string, product?: string, amountRub?: number, email?: string }>} */
    const candidates = new Map();

    for (const row of dbRows) {
      const invId = String(row.external_id ?? '').trim();
      if (!invId || invId.startsWith('manual-')) continue;
      if (row.status === 'paid') continue;
      candidates.set(invId, {
        invId,
        sessionId: row.session_id || undefined,
        product: row.product || undefined,
        amountRub: Number(row.amount) || undefined,
      });
    }

    for (const order of localOrders) {
      const invId = String(order.invId ?? '').trim();
      if (!invId) continue;
      if (order.createdAt && now - order.createdAt > 45 * 24 * 60 * 60 * 1000) continue;
      const prev = candidates.get(invId) ?? { invId };
      candidates.set(invId, {
        invId,
        sessionId: order.sessionId || prev.sessionId,
        product: order.product || prev.product,
        amountRub: order.amountRub ?? prev.amountRub,
        email: order.email || prev.email,
      });
    }

    // Probe недавних InvId: подтянуть оплаты, которых нет ни в pending, ни в локальном файле.
    for (const invId of listRecentRobokassaInvIdProbes(80)) {
      if (!candidates.has(invId)) candidates.set(invId, { invId });
    }

    const paidAlready = await findPaidExternalIds([...candidates.keys()], env);
    let checked = 0;
    let fulfilled = 0;

    for (const [invId, cand] of candidates) {
      if (paidAlready.has(invId)) continue;

      checked += 1;
      const state = await fetchRobokassaOpState(invId, env);
      if (!state?.paid) continue;

      const sessionId = cand.sessionId || state.sessionId;
      const product = cand.product || state.product;
      const email = cand.email || state.email;
      if (!sessionId || !product) {
        console.warn('[reconcile] paid but missing session/product', invId, {
          sessionId,
          product,
          outSum: state.outSum,
        });
        continue;
      }

      const amountRub =
        state.outSum != null && state.outSum > 0 ? state.outSum : cand.amountRub;

      try {
        await fulfillPaidOrder({
          sessionId,
          product,
          amountRub,
          invId,
          email,
        });
        fulfilled += 1;
        console.info('[reconcile] fulfilled', invId, product, amountRub);
      } catch (e) {
        console.error('[reconcile] fulfill failed', invId, e);
      }
    }

    lastReconcileAt = Date.now();
    return { checked, fulfilled, pendingCandidates: candidates.size };
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}
