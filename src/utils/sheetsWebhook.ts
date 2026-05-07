import { SessionResult } from '../types';

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL as string | undefined;

export const sendSessionToSheets = async (session: SessionResult): Promise<void> => {
  if (!WEBHOOK_URL) return;

  const payload = {
    ...session,
    riskLevel: session.status,
  };

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
