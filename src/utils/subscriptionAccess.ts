const SUBSCRIPTION_UNTIL_KEY = 'corta_subscription_until';
const SUBSCRIPTION_SERVER_OK_KEY = 'corta_subscription_server_ok';
const SUBSCRIPTION_EMAIL_KEY = 'corta_subscription_email';

/** Подписка подтверждена сервером (не устаревший локальный кэш). */
export function setSubscriptionFromServer(isoDate: string, email?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUBSCRIPTION_UNTIL_KEY, isoDate);
    localStorage.setItem(SUBSCRIPTION_SERVER_OK_KEY, '1');
    const normalized = email?.trim().toLowerCase();
    if (normalized?.includes('@')) {
      localStorage.setItem(SUBSCRIPTION_EMAIL_KEY, normalized);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated используйте setSubscriptionFromServer */
export function setSubscriptionUntil(isoDate: string): void {
  setSubscriptionFromServer(isoDate);
}

export function clearSubscriptionAccess(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SUBSCRIPTION_UNTIL_KEY);
    localStorage.removeItem(SUBSCRIPTION_SERVER_OK_KEY);
    localStorage.removeItem(SUBSCRIPTION_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Сбросить подписку, если в профиле другой email (чужой кэш в localStorage). */
export function syncSubscriptionEmailBinding(email: string | null | undefined): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = email?.trim().toLowerCase();
  if (!normalized?.includes('@')) return;
  try {
    const bound = localStorage.getItem(SUBSCRIPTION_EMAIL_KEY)?.trim().toLowerCase();
    if (bound && bound !== normalized) clearSubscriptionAccess();
  } catch {
    /* ignore */
  }
}

export function getSubscriptionUntil(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(SUBSCRIPTION_UNTIL_KEY);
  } catch {
    return null;
  }
}

export function isSubscriptionActiveLocal(expectedEmail?: string | null): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(SUBSCRIPTION_SERVER_OK_KEY) !== '1') return false;
    const bound = localStorage.getItem(SUBSCRIPTION_EMAIL_KEY)?.trim().toLowerCase();
    if (!bound) {
      clearSubscriptionAccess();
      return false;
    }
    if (expectedEmail) {
      const expected = expectedEmail.trim().toLowerCase();
      if (!expected.includes('@') || bound !== expected) return false;
    }
    const until = getSubscriptionUntil();
    if (!until) return false;
    const end = new Date(`${until}T23:59:59`);
    if (!Number.isFinite(end.getTime()) || end < new Date()) {
      clearSubscriptionAccess();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
