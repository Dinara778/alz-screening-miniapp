import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION } from '../constants/legalConsent';

type StoredConsent = {
  version: string;
  acceptedAt: string;
};

export function hasLegalConsent(): boolean {
  try {
    const raw = localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as StoredConsent;
    return data.version === LEGAL_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function saveLegalConsent(): void {
  const payload: StoredConsent = {
    version: LEGAL_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(payload));
}
