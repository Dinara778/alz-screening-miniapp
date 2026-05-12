import { SessionResult } from '../types';
import { formatDomainInterpretationPlain, getDomainInterpretationMid52 } from '../copy/cognitiveDomainInterpretationsMid52';
import { buildCognitiveAnalytics } from './cognitiveAnalytics';

type DomainLevel = 'strong' | 'watch' | 'overload';

export type DomainProfile = {
  key:
    | 'wordMemory'
    | 'flanker'
    | 'reaction'
    | 'stroop'
    | 'faceName';
  title: string;
  level: DomainLevel;
  score: number;
  interpretation: string;
  recommendations: string[];
  metrics: string[];
  overloaded: boolean;
};

export type CognitiveProfile = {
  cognitiveStabilityIndex: number;
  overloadIndicators: number;
  overloadText: string;
  domains: DomainProfile[];
  strengths: string[];
  overloadZones: string[];
};

const levelFromScore = (score: number): DomainLevel => {
  if (score >= 72) return 'strong';
  if (score >= 48) return 'watch';
  return 'overload';
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Совместимость с историей и сохранением: строит «старый» профиль из новой аналитики. */
export const buildCognitiveProfile = (session: SessionResult): CognitiveProfile => {
  const a = buildCognitiveAnalytics(session);

  const domainMap: DomainProfile[] = [
    {
      key: 'flanker',
      title: 'Устойчивость внимания',
      level: levelFromScore(a.domains.find((d) => d.key === 'attentionStability')?.score ?? 50),
      score: a.domains.find((d) => d.key === 'attentionStability')?.score ?? 50,
      interpretation: formatDomainInterpretationPlain(getDomainInterpretationMid52('attentionStability')),
      recommendations: a.patterns.find((p) => p.id === 'switching_overload')?.recommendations ?? [],
      metrics: [
        `Точность фланкера: ${a.metrics.flankerIncongruentAccuracy.toFixed(1)}%`,
        `Вариативность фланкера: ${a.metrics.flankerIncongruentCv.toFixed(1)}%`,
      ],
      overloaded: a.patterns.some((p) => p.id === 'switching_overload' && p.active),
    },
    {
      key: 'reaction',
      title: 'Скорость и стабильность реакции',
      level: levelFromScore(
        ((a.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 50) +
          (a.domains.find((d) => d.key === 'reactionStability')?.score ?? 50)) /
          2,
      ),
      score: Math.round(
        ((a.domains.find((d) => d.key === 'reactionSpeed')?.score ?? 50) +
          (a.domains.find((d) => d.key === 'reactionStability')?.score ?? 50)) /
          2,
      ),
      interpretation: [
        'Скорость реакции',
        formatDomainInterpretationPlain(getDomainInterpretationMid52('reactionSpeed')),
        '',
        'Стабильность реакции',
        formatDomainInterpretationPlain(getDomainInterpretationMid52('reactionStability')),
      ].join('\n'),
      recommendations: a.patterns.find((p) => p.id === 'high_reactivity')?.recommendations ?? [],
      metrics: [
        `Медиана времени реакции: ${Math.round(a.metrics.reactionMedianRt)} мс`,
        `Вариативность: ${a.metrics.reactionCv.toFixed(1)}%`,
        `Преждевременные реакции: ${a.metrics.reactionAnticipations}`,
      ],
      overloaded: a.patterns.some((p) => p.id === 'high_reactivity' && p.active),
    },
    {
      key: 'stroop',
      title: 'Когнитивная гибкость',
      level: levelFromScore(a.domains.find((d) => d.key === 'cognitiveFlexibility')?.score ?? 50),
      score: a.domains.find((d) => d.key === 'cognitiveFlexibility')?.score ?? 50,
      interpretation: formatDomainInterpretationPlain(getDomainInterpretationMid52('cognitiveFlexibility')),
      recommendations: a.patterns.find((p) => p.id === 'switching_overload')?.recommendations ?? [],
      metrics: [
        `Конфликт (разница времени): ${a.metrics.stroopInterferenceMs.toFixed(0)} мс`,
        `Ошибки: ${a.metrics.stroopIncongruentErrorRate.toFixed(1)}%`,
      ],
      overloaded: a.patterns.some((p) => p.id === 'switching_overload' && p.active),
    },
    {
      key: 'wordMemory',
      title: 'Удержание информации',
      level: levelFromScore(a.domains.find((d) => d.key === 'informationRetention')?.score ?? 50),
      score: a.domains.find((d) => d.key === 'informationRetention')?.score ?? 50,
      interpretation: formatDomainInterpretationPlain(getDomainInterpretationMid52('informationRetention')),
      recommendations: a.patterns.find((p) => p.id === 'retention_drop')?.recommendations ?? [],
      metrics: [
        `Отсроченно: ${a.metrics.wordDelayedScore}/5`,
        `Разница немедленного и отсроченного: ${a.metrics.wordDelta}`,
        `Лица-имена: ${a.metrics.faceNameScore}/3`,
      ],
      overloaded: a.patterns.some((p) => p.id === 'retention_drop' && p.active),
    },
    {
      key: 'faceName',
      title: 'Ассоциативное удержание',
      level: levelFromScore(a.metrics.faceNameScore * 33),
      score: clamp(a.metrics.faceNameScore * 33),
      interpretation: 'Связь визуального образа и подписи после отвлечения.',
      recommendations: a.patterns.find((p) => p.id === 'retention_drop')?.recommendations ?? [],
      metrics: [`Точность: ${a.metrics.faceNameScore}/3`],
      overloaded: a.metrics.faceNameScore <= 1,
    },
  ];

  return {
    cognitiveStabilityIndex: a.index.value,
    overloadIndicators: a.activePatternCount,
    overloadText: a.index.description,
    domains: domainMap,
    strengths: a.domains.filter((d) => d.score >= 75).map((d) => d.title),
    overloadZones: a.patterns.filter((p) => p.active).map((p) => p.title),
  };
};
