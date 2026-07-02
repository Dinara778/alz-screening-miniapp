const SUBSCRIPTION_UNTIL_KEY = 'corta_subscription_until';

export function setSubscriptionUntil(isoDate: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUBSCRIPTION_UNTIL_KEY, isoDate);
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
  const until = getSubscriptionUntil();
  if (!until) return false;
  const end = new Date(`${until}T23:59:59`);
  return Number.isFinite(end.getTime()) && end >= new Date();
}
