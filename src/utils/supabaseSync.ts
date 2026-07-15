import type { SessionResult } from '../types';
import { buildCognitiveAnalytics, pickRandomPatternRecommendation } from './cognitiveAnalytics';
import { getPaymentsApiUrl } from './telegramPayments';

export type SyncAssessmentPayload = {
  sessionId: string;
  email: string;
  score: number;
  memoryScore: number;
  attentionScore: number;
  speedScore: number;
  stabilityScore: number;
  flexibilityScore: number;
  compensationTip?: string | null;
  sessionData?: SessionResult;
};

function domainScore(
  domains: ReturnType<typeof buildCognitiveAnalytics>['domains'],
  key: string,
): number {
  return domains.find((d) => d.key === key)?.score ?? 50;
}

export function buildSyncAssessmentPayload(session: SessionResult): SyncAssessmentPayload | null {
  const email = session.participant?.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) return null;

  const analytics = buildCognitiveAnalytics(session);
  const compensationTip = pickRandomPatternRecommendation(analytics.patterns, session.id);
  return {
    sessionId: session.id,
    email,
    score: analytics.index.value,
    memoryScore: domainScore(analytics.domains, 'informationRetention'),
    attentionScore: domainScore(analytics.domains, 'attentionStability'),
    speedScore: domainScore(analytics.domains, 'reactionSpeed'),
    stabilityScore: domainScore(analytics.domains, 'reactionStability'),
    flexibilityScore: domainScore(analytics.domains, 'cognitiveFlexibility'),
    compensationTip,
    sessionData: session,
  };
}

/** Отправить результат теста на сервер → Supabase. Ошибки не ломают UX. */
export async function sendSessionToSupabase(session: SessionResult): Promise<void> {
  const payload = buildSyncAssessmentPayload(session);
  if (!payload) return;

  const api = getPaymentsApiUrl();
  if (!api) return;

  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/api/sync-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[supabase-sync] failed', res.status, body.slice(0, 200));
    }
  } catch (e) {
    console.warn('[supabase-sync] network error', e);
  }
}
