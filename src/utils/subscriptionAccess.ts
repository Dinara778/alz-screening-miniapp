const SUBSCRIPTION_UNTIL_KEY = 'corta_subscription_until';
const SUBSCRIPTION_SERVER_OK_KEY = 'corta_subscription_server_ok';

/** Подписка подтверждена сервером (не устаревший локальный кэш). */
export function setSubscriptionFromServer(isoDate: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUBSCRIPTION_UNTIL_KEY, isoDate);
    localStorage.setItem(SUBSCRIPTION_SERVER_OK_KEY, '1');
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

export function isSubscriptionActiveLocal(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(SUBSCRIPTION_SERVER_OK_KEY) !== '1') return false;
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
