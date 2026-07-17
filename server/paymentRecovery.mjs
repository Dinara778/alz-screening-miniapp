/**
 * Восстановление статуса оплаты с сайта — единая серверная логика.
 *
 * Инварианты (не менять без paymentRecovery.test.mjs):
 * 1. full_report оплачен → доступ к отчёту для sessionId.
 * 2. subscription оплачена / активна по email → доступ к подписке, не путать с п.1 при checkout.
 * 3. Оплата full_report НЕ считается оплатой subscription_* при запросе подписки.
 * 4. Оплата subscription даёт доступ к full_report (подписчик видит отчёт, в т.ч. при новом прохождении).
 */

export function createResolveWebPaymentRecovery(deps) {
  const {
    isWebPaidForSession,
    markWebPaid,
    findPaidProductPayment,
    findActiveSubscriptionByEmail,
    reassignPaidPaymentSession,
    isSupabaseConfigured,
    robokassaGetOrder,
    isSubscriptionProduct,
  } = deps;

  return async function resolveWebPaymentRecovery({
    sessionId,
    product = 'full_report',
    email,
    invId,
  }) {
    const sid = String(sessionId ?? '').trim();
    const prod = String(product ?? 'full_report');
    const normalizedEmail =
      typeof email === 'string' && email.trim().toLowerCase().includes('@')
        ? email.trim().toLowerCase()
        : null;
    if (!sid) return { paid: false };

    const wantsReport = prod === 'full_report';
    const wantsSubscription = isSubscriptionProduct(prod);

    const exact = isWebPaidForSession(sid, prod);
    if (exact.paid) {
      const sub = normalizedEmail ? await findActiveSubscriptionByEmail(normalizedEmail) : null;
      return {
        paid: true,
        sessionId: exact.sessionId,
        product: exact.product,
        subscriptionUntil: sub?.end_date ?? undefined,
      };
    }

    if (wantsReport) {
      const reportPaid = isWebPaidForSession(sid, 'full_report');
      if (reportPaid.paid) {
        return { paid: true, sessionId: reportPaid.sessionId, product: prod };
      }
    }

    const invKey = String(invId ?? '').trim();
    if (invKey) {
      const order = robokassaGetOrder(invKey);
      if (order) {
        const webPaidForOrder = isWebPaidForSession(order.sessionId, order.product).paid;

        let paidInSupabase = null;
        if (isSupabaseConfigured()) {
          paidInSupabase = await findPaidProductPayment({
            sessionId: order.sessionId,
            email: normalizedEmail || order.email,
            product: order.product,
          });
        }

        if (webPaidForOrder || paidInSupabase) {
          if (order.sessionId !== sid) {
            markWebPaid({
              sessionId: sid,
              product: wantsReport ? 'full_report' : order.product,
              invId: invKey,
            });
          }
          const sub =
            normalizedEmail || order.email
              ? await findActiveSubscriptionByEmail(normalizedEmail || order.email)
              : null;
          return {
            paid: true,
            sessionId: sid,
            product: prod,
            subscriptionUntil: sub?.end_date ?? undefined,
          };
        }
      }
    }

    if (isSupabaseConfigured()) {
      if (normalizedEmail) {
        const sub = await findActiveSubscriptionByEmail(normalizedEmail);
        if (sub?.end_date) {
          if (wantsSubscription) {
            return { paid: true, sessionId: sid, product: prod, subscriptionUntil: sub.end_date };
          }
          if (wantsReport) {
            markWebPaid({ sessionId: sid, product: 'full_report', invId: invKey });
            return { paid: true, sessionId: sid, product: prod, subscriptionUntil: sub.end_date };
          }
        }
      }

      const supa = await findPaidProductPayment({
        sessionId: sid,
        email: normalizedEmail,
        product: prod,
      });
      if (supa) {
        let resolvedSessionId = supa.session_id ?? sid;
        if (resolvedSessionId !== sid) {
          await reassignPaidPaymentSession(supa.id, sid);
          resolvedSessionId = sid;
        }
        markWebPaid({
          sessionId: resolvedSessionId,
          product: wantsReport ? 'full_report' : prod,
          invId: supa.external_id ?? '',
        });
        const sub = normalizedEmail ? await findActiveSubscriptionByEmail(normalizedEmail) : null;
        return {
          paid: true,
          sessionId: resolvedSessionId,
          product: prod,
          subscriptionUntil: sub?.end_date ?? undefined,
        };
      }

      if (wantsReport && normalizedEmail) {
        for (const candidate of ['subscription_1m', 'subscription_3m']) {
          const alt = await findPaidProductPayment({
            sessionId: sid,
            email: normalizedEmail,
            product: candidate,
          });
          if (!alt) continue;
          markWebPaid({
            sessionId: sid,
            product: 'full_report',
            invId: alt.external_id ?? '',
          });
          const sub = await findActiveSubscriptionByEmail(normalizedEmail);
          return {
            paid: true,
            sessionId: sid,
            product: prod,
            subscriptionUntil: sub?.end_date ?? undefined,
          };
        }
      }
    }

    return { paid: false };
  };
}
