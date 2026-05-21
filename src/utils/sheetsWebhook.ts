import { SessionResult } from '../types';

const WEBHOOK_URL_RAW = (import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined)?.trim();

function getSheetsWebhookUrl(): string | null {
  if (!WEBHOOK_URL_RAW) return null;
  if (!WEBHOOK_URL_RAW.startsWith('https://script.google.com/')) return null;
  if (WEBHOOK_URL_RAW.includes('REPLACE_WITH_YOUR')) return null;
  return WEBHOOK_URL_RAW;
}

/** Настроен ли реальный URL (не пустой и не заглушка из .env.example). */
export const isSheetsWebhookConfigured = (): boolean => Boolean(getSheetsWebhookUrl());

type AnalyticsEventPayload = {
  eventType: string;
  sessionId: string;
  stage?: string;
  timestamp?: string;
  participant?: {
    name?: string;
    email?: string;
    phone?: string;
    sex?: string;
    age?: number;
    education?: string;
    pcConfidence?: number;
  };
  [key: string]: unknown;
};

export const sendAnalyticsEventToSheets = async (event: AnalyticsEventPayload): Promise<boolean> => {
  const url = getSheetsWebhookUrl();
  if (!url) return false;

  const payload = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const sendSessionToSheets = async (session: SessionResult): Promise<void> => {
  const url = getSheetsWebhookUrl();
  if (!url) return;

  const payload = {
    ...session,
    riskLevel: session.status,
    eventType: 'session_completed',
    sessionId: session.id,
    timestamp: new Date().toISOString(),
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
