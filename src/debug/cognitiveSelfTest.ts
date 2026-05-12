import { buildCognitiveAnalytics, type CognitiveAnalytics } from '../utils/cognitiveAnalytics';
import type { SessionResult } from '../types';
import {
  buildHighVariabilitySession,
  buildSlowStableSession,
  buildStableUserSession,
} from './syntheticSessions';

export type SelfValidationCaseReport = {
  caseId: string;
  raw: {
    reactionSuccessfulRts: number[];
    reactionAnticipations: number;
    flankerTrialCount: number;
    stroopTrialCount: number;
  };
  validation: { interpretationTrusted: boolean; warnings: string[] };
  intermediate: {
    reactionMedianRt: number;
    reactionCv: number;
    stroopInterferenceMs: number;
    flankerIncongruentAccuracy: number;
  };
  normalized: {
    indexValue: number;
    domainScores: Record<string, number>;
    activePatternIds: string[];
  };
  interpretation: { indexLabel: string; indexBand: string };
};

function summarize(session: SessionResult, a: CognitiveAnalytics): SelfValidationCaseReport {
  const speed = a.domains.find((d) => d.key === 'reactionSpeed');
  const stab = a.domains.find((d) => d.key === 'reactionStability');
  return {
    caseId: session.id,
    raw: {
      reactionSuccessfulRts: [...session.reaction.successfulRTs],
      reactionAnticipations: session.reaction.anticipations,
      flankerTrialCount: session.flanker.trials.length,
      stroopTrialCount: session.stroop.trials.length,
    },
    validation: { ...a.validation },
    intermediate: {
      reactionMedianRt: a.metrics.reactionMedianRt,
      reactionCv: a.metrics.reactionCv,
      stroopInterferenceMs: a.metrics.stroopInterferenceMs,
      flankerIncongruentAccuracy: a.metrics.flankerIncongruentAccuracy,
    },
    normalized: {
      indexValue: a.index.value,
      domainScores: Object.fromEntries(a.domains.map((d) => [d.key, d.score])),
      activePatternIds: a.patterns.filter((p) => p.active).map((p) => p.id),
    },
    interpretation: { indexLabel: a.index.label, indexBand: a.index.bandKey },
  };
}

/** Прогон синтетических сессий + структура для логов / UI отладки. */
export function runCognitiveSelfValidation(): SelfValidationCaseReport[] {
  const sessions: { id: string; session: SessionResult }[] = [
    { id: 'CASE1_STABLE', session: { ...buildStableUserSession(), id: 'CASE1_STABLE' } },
    { id: 'CASE2_SLOW_STABLE', session: { ...buildSlowStableSession(), id: 'CASE2_SLOW_STABLE' } },
    { id: 'CASE3_HIGH_VAR', session: { ...buildHighVariabilitySession(), id: 'CASE3_HIGH_VAR' } },
  ];
  return sessions.map(({ id, session }) => summarize(session, buildCognitiveAnalytics(session)));
}

/** Текстовый отчёт для консоли (dev / поддержка). */
export function formatCognitiveSelfValidationText(): string {
  const rows = runCognitiveSelfValidation();
  const lines: string[] = ['=== Cognitive self-validation ==='];
  for (const r of rows) {
    lines.push(`\n--- ${r.caseId} ---`);
    lines.push(`raw RT: [${r.raw.reactionSuccessfulRts.join(', ')}]`);
    lines.push(`warnings: ${r.validation.warnings.length ? r.validation.warnings.join(' | ') : '(none)'}`);
    lines.push(`trusted: ${r.validation.interpretationTrusted}`);
    lines.push(
      `intermediate: medianRT=${r.intermediate.reactionMedianRt} CV=${r.intermediate.reactionCv.toFixed(2)}% ` +
        `stroopIF=${r.intermediate.stroopInterferenceMs.toFixed(0)} flankAcc=${r.intermediate.flankerIncongruentAccuracy.toFixed(1)}%`,
    );
    lines.push(`domains: ${JSON.stringify(r.normalized.domainScores)}`);
    lines.push(`patterns: [${r.normalized.activePatternIds.join(', ')}]`);
    lines.push(`index: ${r.normalized.indexValue} — ${r.interpretation.indexLabel} (${r.interpretation.indexBand})`);
  }
  lines.push('\n=== end ===\n');
  return lines.join('\n');
}
