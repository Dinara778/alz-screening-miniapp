/**
 * Серверная аналитика оплат: Google Sheets + опционально Telegram админу.
 * Не зависит от того, напишет ли пользователь в поддержку.
 */

export function createPaymentAnalytics({ forwardToGoogleSheets, tgApi, botToken }) {
  const adminChatId = () => process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  function trackPayment(eventType, fields = {}) {
    void forwardToGoogleSheets({
      eventType,
      timestamp: new Date().toISOString(),
      stage: 'payment',
      screen: 'server',
      ...fields,
    }).catch((err) => {
      console.error('[payment-analytics]', eventType, err);
    });
  }

  function notifyAdmin(text) {
    const chatId = adminChatId();
    if (!chatId || !botToken) return;
    void tgApi('sendMessage', {
      chat_id: chatId,
      text: text.slice(0, 3900),
      disable_web_page_preview: true,
    }).catch((err) => {
      console.error('[payment-analytics] admin notify', err);
    });
  }

  function trackInvoiceError({ sessionId, product, tgUserId, httpStatus, error, extra }) {
    trackPayment('payment_invoice_error', {
      sessionId: sessionId || null,
      product: product || null,
      tgUserId: tgUserId ?? null,
      httpStatus,
      error: String(error).slice(0, 500),
      ...extra,
    });
    notifyAdmin(
      [
        '⚠️ Corta: ошибка создания счёта',
        `Статус: ${httpStatus}`,
        `Ошибка: ${String(error).slice(0, 300)}`,
        `product: ${product || '—'}`,
        `sessionId: ${sessionId || '—'}`,
        tgUserId != null ? `tgUserId: ${tgUserId}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  function trackInvoiceCreated({ sessionId, product, tgUserId }) {
    trackPayment('payment_invoice_created', {
      sessionId: sessionId || null,
      product: product || null,
      tgUserId: tgUserId ?? null,
    });
  }

  function trackPaidOnServer({ sessionId, product, tgUserId, payload }) {
    trackPayment('payment_paid_server', {
      sessionId: sessionId || null,
      product: product || null,
      tgUserId: tgUserId ?? null,
      payload: payload ? String(payload).slice(0, 128) : null,
    });
  }

  function trackPreCheckoutFailed({ queryId, error }) {
    trackPayment('payment_pre_checkout_failed', {
      preCheckoutQueryId: queryId || null,
      error: String(error).slice(0, 500),
    });
    notifyAdmin(
      ['⚠️ Corta: pre_checkout не подтверждён', `query: ${queryId || '—'}`, `Ошибка: ${String(error).slice(0, 300)}`].join(
        '\n',
      ),
    );
  }

  return {
    trackPayment,
    trackInvoiceError,
    trackInvoiceCreated,
    trackPaidOnServer,
    trackPreCheckoutFailed,
  };
}
