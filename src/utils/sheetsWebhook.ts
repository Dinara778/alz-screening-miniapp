import { SessionResult } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined;

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
  if (!WEBHOOK_URL) return false;

  const payload = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
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
  if (!WEBHOOK_URL) return;

  const payload = {
    ...session,
    riskLevel: session.status,
    eventType: 'session_completed',
    sessionId: session.id,
    timestamp: new Date().toISOString(),
  };

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
