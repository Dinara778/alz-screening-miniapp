/** После «Обновить» на экране отчёта — снова открыть оплаченный отчёт. */
export const REOPEN_PAID_REPORT_KEY = 'alz_reopen_paid_report';

export function markReopenPaidReportAfterReload(sessionId: string): void {
  try {
    sessionStorage.setItem(REOPEN_PAID_REPORT_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

export function consumeReopenPaidReportSessionId(): string | null {
  try {
    const id = sessionStorage.getItem(REOPEN_PAID_REPORT_KEY);
    sessionStorage.removeItem(REOPEN_PAID_REPORT_KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}
