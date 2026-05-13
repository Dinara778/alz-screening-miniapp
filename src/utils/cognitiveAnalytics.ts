import type { CognitiveDomainKey, SessionResult } from '../types';
import { getDomainInterpretationMid52, type DomainInterpretationCopy } from '../copy/cognitiveDomainInterpretationsMid52';
import { avg, cv, median } from './metrics';
import {
  getGranularIndexInterpretation,
  type IndexInterpretation,
} from './indexInterpretationBands';
import { MIN_VALID_REACTION_RT_MS, sanitizeReactionRts } from './reactionMetrics';

export type { IndexBandKey, IndexInterpretation, OverloadVisualTier } from './indexInterpretationBands';

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Балл домена «скорость реакции» по медиане RT (мс): медленный, но валидный ответ не обнуляет шкалу. */
export const reactionSpeedDomainScoreFromMedian = (medianRtMs: number): number => {
  if (!Number.isFinite(medianRtMs) || medianRtMs <= 0) return 50;
  const fast = 220;
  const slow = 920;
  const span = slow - fast;
  const u = (medianRtMs - fast) / span;
  const raw = 88 - u * 76;
  return clampScore(Math.max(12, Math.min(96, raw)));
};

const finiteAvg = (arr: number[]): number => {
  const ok = arr.filter((x) => Number.isFinite(x));
  if (!ok.length) return NaN;
  return ok.reduce((a, b) => a + b, 0) / ok.length;
};

const stroopInterferenceSafe = (session: SessionResult): number => {
  const inc = session.stroop.trials.filter((t) => t.type === 'incongruent');
  const cong = session.stroop.trials.filter((t) => t.type === 'congruent');
  const incRt = finiteAvg(inc.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  const congRt = finiteAvg(cong.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  if (!Number.isFinite(incRt) || !Number.isFinite(congRt)) return 0;
  return Math.max(0, incRt - congRt);
};

export type CognitivePattern = {
  id: 'attention_instability' | 'switching_overload' | 'retention_drop' | 'high_reactivity';
  title: string;
  active: boolean;
  description: string;
  livedExperience: string[];
  recommendations: string[];
};

export type { CognitiveDomainKey as DomainKey } from '../types';

export type DomainScore = {
  key: CognitiveDomainKey;
  title: string;
  score: number;
  /** Краткая строка (для совместимости): «О чём говорит результат». */
  shortDescription: string;
  interpretation: DomainInterpretationCopy;
};

export type OverloadMapItem = {
  id: string;
  title: string;
  active: boolean;
  explanation: string;
  lifeManifestation: string;
};

export type ConcentrationDriver = {
  text: string;
  weight: number;
};

export type MicroRecommendation = {
  text: string;
};

export type CognitiveAnalyticsValidation = {
  /** Итоговые формулировки индекса не заменяют полноценный замер при критических пробелах данных */
  interpretationTrusted: boolean;
  warnings: string[];
};

export type CognitiveAnalytics = {
  metrics: {
    reactionMedianRt: number;
    reactionCv: number;
    reactionAnticipations: number;
    flankerIncongruentAccuracy: number;
    flankerIncongruentCv: number;
    stroopInterferenceMs: number;
    stroopIncongruentErrorRate: number;
    stroopIncongruentCv: number;
    wordDelayedScore: number;
    wordImmediateScore: number;
    wordDelta: number;
    faceNameScore: number;
  };
  index: IndexInterpretation;
  domains: DomainScore[];
  patterns: CognitivePattern[];
  overloadMap: OverloadMapItem[];
  concentrationDrivers: ConcentrationDriver[];
  stabilizationTips: MicroRecommendation[];
  /** Legacy-compatible count for session.flags */
  activePatternCount: number;
  validation: CognitiveAnalyticsValidation;
};

const degradedIndex = (value: number): IndexInterpretation => {
  const v = Number.isFinite(value) ? clampScore(value) : 50;
  return {
    value: v,
    bandKey: 'yellow',
    granularId: 'degraded',
    label: 'Ограниченная достоверность профиля',
    description:
      'Часть исходных данных отсутствует, некорректна или неполна. Итоговые формулировки не заменяют повторный замер при полном прохождении блоков.',
    barColorClass: 'bg-slate-400',
    recommendations: [
      'Повторите замер, полностью пройдя все блоки теста без пропусков.',
      'Проверьте стабильность интернет-соединения и устройства перед следующей попыткой.',
      'Не опирайтесь на индекс как на полный профиль — число ориентировочно занижено из имеющихся данных.',
    ],
    overloadMapIntro:
      'Из-за неполных данных карта перегрузки ниже ориентировочная: при повторном прохождении она станет точнее и персональнее.',
    overloadVisualTier: 1,
  };
};

const collectMetricWarnings = (
  session: SessionResult,
  reactionCleaned: number[],
  reactionDropped: number,
): string[] => {
  const w: string[] = [];
  if (reactionDropped > 0) {
    w.push(
      `Отброшено ${reactionDropped} значений времени реакции (< ${MIN_VALID_REACTION_RT_MS} мс или не число).`,
    );
  }
  if (!session.reaction.successfulRTs?.length) w.push('Нет данных простой реакции (RT).');
  else if (reactionCleaned.length === 0) w.push('После проверки не осталось валидных RT для расчёта реакции.');
  else if (reactionCleaned.length < 3) {
    w.push('Мало валидных проб реакции (< 3); оценки скорости и стабильности менее надёжны.');
  }

  const stroopInc = session.stroop.trials.filter((t) => t.type === 'incongruent');
  if (!stroopInc.length) w.push('Нет неконгруэнтных проб Струпа.');
  else if (!stroopInc.some((t) => t.correct && t.rt !== null)) {
    w.push('Нет корректных ответов на неконгруэнтные пробы Струпа.');
  }

  const flankInc = session.flanker.trials.filter((t) => t.type === 'incongruent');
  if (!flankInc.length) w.push('Нет неконгруэнтных проб фланкера.');

  return w;
};

export const buildCognitiveAnalytics = (session: SessionResult): CognitiveAnalytics => {
  const { cleaned: reactionRtsClean, droppedInvalid: reactionDropped } = sanitizeReactionRts(
    session.reaction.successfulRTs,
  );

  const warnings = collectMetricWarnings(session, reactionRtsClean, reactionDropped);

  const reactionMedianRt = reactionRtsClean.length ? median(reactionRtsClean) : 0;
  const reactionCv = reactionRtsClean.length ? cv(reactionRtsClean) : 0;

  const stroopInterferenceMs = stroopInterferenceSafe(session);

  const m = {
    reactionMedianRt,
    reactionCv,
    reactionAnticipations: session.reaction.anticipations,
    flankerIncongruentAccuracy: session.flanker.incongruentAccuracy,
    flankerIncongruentCv: session.flanker.incongruentCv,
    stroopInterferenceMs,
    stroopIncongruentErrorRate: session.stroop.incongruentErrorRate,
    stroopIncongruentCv: session.stroop.incongruentCv,
    wordDelayedScore: session.wordMemory.delayedScore,
    wordImmediateScore: session.wordMemory.immediateScore,
    wordDelta: session.wordMemory.immediateScore - session.wordMemory.delayedScore,
    faceNameScore: session.faceName.score,
  };

  for (const [key, val] of Object.entries(m) as [keyof typeof m, number][]) {
    if (typeof val === 'number' && (!Number.isFinite(val) || Number.isNaN(val))) {
      warnings.push(`Некорректное значение метрики «${String(key)}» (NaN / не число).`);
    }
  }

  const stroopIncTrials = session.stroop.trials.filter((t) => t.type === 'incongruent');
  const flankIncTrials = session.flanker.trials.filter((t) => t.type === 'incongruent');

  const reactionTrusted = reactionRtsClean.length >= 3;
  const interpretationTrusted =
    reactionTrusted &&
    flankIncTrials.length > 0 &&
    stroopIncTrials.some((t) => t.correct && t.rt !== null);

  if (reactionTrusted && m.reactionMedianRt === 0) {
    warnings.push('Медиана времени реакции равна 0 при непустой выборке — проверьте сбор RT.');
  }

  /**
   * «Нестабильность внимания» на карте перегрузки и в паттернах —
   * только при превышении порогов по сырым метрикам (согласовано с red flags в scoring.ts).
   */
  const attentionInstability =
    (Number.isFinite(m.flankerIncongruentCv) && m.flankerIncongruentCv > 40) ||
    (reactionTrusted && Number.isFinite(m.reactionCv) && m.reactionCv > 35) ||
    (reactionTrusted && m.reactionAnticipations > 3);

  const switchingOverload =
    m.flankerIncongruentAccuracy < 72 || m.stroopInterferenceMs > 185;

  const retentionDrop = session.wordMemory.redFlag;

  const highReactivity =
    (reactionTrusted && m.reactionAnticipations >= 3) ||
    m.stroopIncongruentErrorRate > 18 ||
    m.flankerIncongruentAccuracy < 65;

  const patterns: CognitivePattern[] = [
    {
      id: 'attention_instability',
      title: 'Нестабильность внимания',
      active: attentionInstability,
      description: 'Внимание способно работать быстро, но теряет стабильность при длительной нагрузке.',
      livedExperience: [
        'сложно долго удерживать концентрацию',
        'продуктивность становится неравномерной',
        'внимание быстрее истощается',
      ],
      recommendations: [
        'Уменьшите количество параллельных задач.',
        'Работайте с одной главной задачей за раз.',
        'Снижайте количество переключений внимания.',
      ],
    },
    {
      id: 'switching_overload',
      title: 'Перегрузка переключением',
      active: switchingOverload,
      description: 'Мозг тратит слишком много ресурсов на обработку конкурирующей информации.',
      livedExperience: [
        'сложно удерживать сосредоточение',
        'появляется ощущение перегруженности',
        'мозг быстрее устаёт от информационного шума',
      ],
      recommendations: [
        'Уменьшите количество уведомлений.',
        'Сократите частоту переключения контекста.',
        'Разделяйте сложные задачи во времени.',
      ],
    },
    {
      id: 'retention_drop',
      title: 'Снижение устойчивости удержания информации',
      active: retentionDrop,
      description:
        'Информация становится менее устойчивой к интерференции и быстрее теряется под нагрузкой.',
      livedExperience: [
        'сложнее удерживать контекст',
        'мысли быстрее распадаются',
        'возрастает ощущение когнитивной перегрузки',
      ],
      recommendations: [
        'Уменьшите информационный шум.',
        'Избегайте многозадачности.',
        'Делайте короткие паузы между блоками информации.',
      ],
    },
    {
      id: 'high_reactivity',
      title: 'Высокая реактивность',
      active: highReactivity,
      description: 'Мозг стремится реагировать быстрее, чем успевает стабильно обработать информацию.',
      livedExperience: [
        'импульсивные ответы',
        'ощущение внутренней спешки',
        'снижение точности при скорости',
      ],
      recommendations: [
        'Снижайте темп переключений.',
        'Делайте короткую паузу перед ответом.',
        'Уменьшайте количество внешних стимулов.',
      ],
    },
  ];

  const attentionScore = clampScore(
    m.flankerIncongruentAccuracy * 0.65 + (40 - Math.min(m.flankerIncongruentCv, 40)) * 0.9,
  );

  const reactionSpeedScore = reactionTrusted
    ? reactionSpeedDomainScoreFromMedian(m.reactionMedianRt)
    : 50;
  const reactionStabilityScore = reactionTrusted
    ? clampScore(100 - m.reactionCv * 1.1 - m.reactionAnticipations * 6)
    : 50;

  const flexibilityScore = clampScore(
    100 -
      Math.min(m.stroopInterferenceMs / 4.5, 45) -
      m.stroopIncongruentErrorRate * 0.9 -
      Math.min(m.stroopIncongruentCv, 50) * 0.35,
  );
  const retentionScore = clampScore(
    m.wordDelayedScore * 16 +
      (5 - m.wordDelta) * 8 +
      m.faceNameScore * 10 -
      Math.max(0, m.wordDelta - 2) * 12,
  );

  const mkDomain = (key: CognitiveDomainKey, title: string, score: number): DomainScore => {
    const interpretation = getDomainInterpretationMid52(key);
    return {
      key,
      title,
      score,
      shortDescription: interpretation.aboutResult,
      interpretation,
    };
  };

  const domains: DomainScore[] = [
    mkDomain('attentionStability', 'Устойчивость внимания', attentionScore),
    mkDomain('reactionSpeed', 'Скорость реакции', reactionSpeedScore),
    mkDomain('reactionStability', 'Стабильность реакции', reactionStabilityScore),
    mkDomain('cognitiveFlexibility', 'Когнитивная гибкость', flexibilityScore),
    mkDomain('informationRetention', 'Удержание информации', retentionScore),
  ];

  const rawIndex = avg(domains.map((d) => d.score));
  const indexValue = Number.isFinite(rawIndex) ? clampScore(rawIndex) : 50;
  const index = interpretationTrusted ? getGranularIndexInterpretation(indexValue) : degradedIndex(indexValue);

  const cognitiveExhaustion =
    reactionTrusted &&
    m.reactionCv > 38 &&
    m.reactionMedianRt > 360 &&
    domains.filter((d) => d.score < 55).length >= 2;

  const loadResistanceDrop =
    domains.filter((d) => d.score < 50).length >= 3 && indexValue < 55;

  const overloadMap: OverloadMapItem[] = [
    {
      id: 'switch',
      title: 'Перегрузка переключением',
      active: switchingOverload,
      explanation: patterns.find((p) => p.id === 'switching_overload')?.description ?? '',
      lifeManifestation:
        'Ощущение, что контекст «рвётся»: сложнее вернуться к задаче после отвлечения.',
    },
    {
      id: 'unstable_attention',
      title: 'Нестабильность внимания',
      active: attentionInstability,
      explanation: patterns.find((p) => p.id === 'attention_instability')?.description ?? '',
      lifeManifestation: 'Рабочие блоки короче, концентрация «плавает», продуктивность неравномерная.',
    },
    {
      id: 'reactivity',
      title: 'Высокая реактивность',
      active: highReactivity,
      explanation: patterns.find((p) => p.id === 'high_reactivity')?.description ?? '',
      lifeManifestation: 'Хочется отвечать быстрее, чем успеваете осознать условие задачи.',
    },
    {
      id: 'exhaustion',
      title: 'Когнитивное истощение',
      active: cognitiveExhaustion,
      explanation:
        'Сочетание более медленного темпа и высокой вариативности указывает на повышенную цену задачи для системы внимания.',
      lifeManifestation: 'Быстрее наступает спад точности и ощущение «выжатости» к концу блока.',
    },
    {
      id: 'load_resistance',
      title: 'Снижение устойчивости под нагрузкой',
      active: loadResistanceDrop,
      explanation:
        'Несколько доменов одновременно проседают: нагрузка распределяется неравномерно и быстрее снижает качество.',
      lifeManifestation: 'Сложнее удерживать стабильный режим при длинной серии стимулов.',
    },
  ];

  const drivers: ConcentrationDriver[] = [];
  if (switchingOverload) drivers.push({ text: 'постоянные переключения внимания', weight: 4 });
  if (attentionInstability) drivers.push({ text: 'нестабильный когнитивный темп', weight: 3 });
  if (m.stroopIncongruentErrorRate > 15 || m.flankerIncongruentCv > 30) {
    drivers.push({ text: 'перегрузка стимуляцией', weight: 3 });
  }
  if (reactionTrusted && m.reactionCv > 30) {
    drivers.push({ text: 'высокий информационный шум внутри задачи', weight: 2 });
  }
  if (retentionDrop) drivers.push({ text: 'снижение устойчивости при длительной концентрации', weight: 2 });
  if (highReactivity) drivers.push({ text: 'высокая реактивность на скорость', weight: 2 });
  drivers.sort((a, b) => b.weight - a.weight);

  const fromBand: MicroRecommendation[] = index.recommendations.map((text) => ({ text }));
  const fromPatterns: MicroRecommendation[] = [];
  patterns
    .filter((p) => p.active)
    .forEach((p) => {
      p.recommendations.forEach((t) => fromPatterns.push({ text: t }));
    });

  const stabilizationTips: MicroRecommendation[] = [];
  const seenTip = new Set<string>();
  const pushUnique = (items: MicroRecommendation[]) => {
    for (const { text } of items) {
      const k = text.trim();
      if (!k || seenTip.has(k)) continue;
      seenTip.add(k);
      stabilizationTips.push({ text });
    }
  };
  pushUnique(fromBand);
  pushUnique(fromPatterns);
  if (!stabilizationTips.length) {
    stabilizationTips.push(
      { text: 'Сохраняйте чередование сосредоточенной работы (25–50 минут) и короткого восстановления (5–10 минут).' },
      { text: 'Фиксируйте один главный канал входящей информации в рабочем окне.' },
    );
  }

  const activePatternCount = patterns.filter((p) => p.active).length;

  return {
    metrics: m,
    index,
    domains,
    patterns,
    overloadMap,
    concentrationDrivers: drivers,
    stabilizationTips: stabilizationTips.slice(0, 8),
    activePatternCount,
    validation: {
      interpretationTrusted,
      warnings,
    },
  };
};
