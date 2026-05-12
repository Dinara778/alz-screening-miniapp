import { SessionResult } from '../types';
import { avg, cv, median } from './metrics';
import { MIN_VALID_REACTION_RT_MS, sanitizeReactionRts } from './reactionMetrics';

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

export type IndexBandKey = 'green' | 'lightGreen' | 'yellow' | 'orange' | 'red';

export type IndexInterpretation = {
  value: number;
  bandKey: IndexBandKey;
  label: string;
  description: string;
  barColorClass: string;
};

export type CognitivePattern = {
  id: 'attention_instability' | 'switching_overload' | 'retention_drop' | 'high_reactivity';
  title: string;
  active: boolean;
  description: string;
  livedExperience: string[];
  recommendations: string[];
};

export type DomainKey =
  | 'attentionStability'
  | 'reactionSpeed'
  | 'reactionStability'
  | 'cognitiveFlexibility'
  | 'informationRetention';

export type DomainScore = {
  key: DomainKey;
  title: string;
  score: number;
  shortDescription: string;
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

const interpretIndex = (value: number): IndexInterpretation => {
  const safe = Number.isFinite(value) ? value : 50;
  if (safe >= 80) {
    return {
      value: safe,
      bandKey: 'green',
      label: 'Высокая когнитивная устойчивость',
      description:
        'Внимание работает стабильно даже при нагрузке. Мозг хорошо удерживает темп обработки информации и устойчивость концентрации.',
      barColorClass: 'bg-emerald-600',
    };
  }
  if (safe >= 60) {
    return {
      value: safe,
      bandKey: 'lightGreen',
      label: 'Умеренно стабильное состояние',
      description:
        'В целом внимание работает устойчиво, но при высокой нагрузке начинают появляться признаки нестабильности.',
      barColorClass: 'bg-lime-500',
    };
  }
  if (safe >= 40) {
    return {
      value: safe,
      bandKey: 'yellow',
      label: 'Нестабильность под нагрузкой',
      description:
        'Сейчас внимание начинает быстрее терять устойчивость при когнитивной нагрузке и переключении контекста.',
      barColorClass: 'bg-amber-400',
    };
  }
  if (safe >= 20) {
    return {
      value: safe,
      bandKey: 'orange',
      label: 'Выраженная перегрузка внимания',
      description:
        'Мозг работает в режиме повышенной перегрузки. Устойчивость внимания и стабильность обработки информации снижены.',
      barColorClass: 'bg-orange-500',
    };
  }
  return {
    value: safe,
    bandKey: 'red',
    label: 'Критически низкая устойчивость',
    description:
      'Сейчас внимание и устойчивость мышления работают нестабильно даже при умеренной нагрузке.',
    barColorClass: 'bg-red-600',
  };
};

const degradedIndex = (value: number): IndexInterpretation => ({
  value: Number.isFinite(value) ? clampScore(value) : 50,
  bandKey: 'yellow',
  label: 'Ограниченная достоверность профиля',
  description:
    'Часть исходных данных отсутствует, некорректна или неполна. Итоговые формулировки не заменяют повторный замер при полном прохождении блоков.',
  barColorClass: 'bg-slate-400',
});

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
        'уменьшить количество параллельных задач',
        'работать с одной главной задачей за раз',
        'снижать количество переключений внимания',
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
        'уменьшить количество уведомлений',
        'сократить частоту переключения контекста',
        'разделять сложные задачи по времени',
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
        'уменьшить информационный шум',
        'избегать многозадачности',
        'делать короткие паузы между блоками информации',
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
        'снижать темп переключений',
        'делать короткую паузу перед ответом',
        'уменьшать количество внешних стимулов',
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

  let reactionSpeedShort: string;
  if (!reactionTrusted) {
    reactionSpeedShort = 'Недостаточно валидных данных реакции для оценки темпа.';
  } else if (reactionSpeedScore >= 70) {
    reactionSpeedShort = 'Темп обработки сигнала в комфортном диапазоне.';
  } else if (m.reactionMedianRt > 520) {
    reactionSpeedShort =
      'Темп ответа медленнее среднего; при этом допустима осторожная, ровная обработка сигнала.';
  } else {
    reactionSpeedShort = 'Темп ответа быстрее или менее ровный относительно оптимального диапазона.';
  }

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

  const domains: DomainScore[] = [
    {
      key: 'attentionStability',
      title: 'Устойчивость внимания',
      score: attentionScore,
      shortDescription:
        attentionScore >= 70
          ? 'Удержание сосредоточения при конкурирующих стимулах в пределах нормы для короткого замера.'
          : 'Точность и устойчивость внимания под конфликтом снижаются быстрее обычного.',
    },
    {
      key: 'reactionSpeed',
      title: 'Скорость реакции',
      score: reactionSpeedScore,
      shortDescription: reactionSpeedShort,
    },
    {
      key: 'reactionStability',
      title: 'Стабильность реакции',
      score: reactionStabilityScore,
      shortDescription: !reactionTrusted
        ? 'Недостаточно валидных данных реакции для оценки стабильности.'
        : reactionStabilityScore >= 70
          ? 'Мало разброса по времени реакции и мало преждевременных ответов.'
          : 'Вариативность реакций или преждевременные ответы повышают нестабильность.',
    },
    {
      key: 'cognitiveFlexibility',
      title: 'Когнитивная гибкость',
      score: flexibilityScore,
      shortDescription:
        flexibilityScore >= 70
          ? 'Конфликт «смысла и цвета» обрабатывается без критического роста затрат.'
          : 'Конфликтная задача требует больше ресурсов: растут задержки или ошибки.',
    },
    {
      key: 'informationRetention',
      title: 'Удержание информации',
      score: retentionScore,
      shortDescription:
        retentionScore >= 70
          ? 'Удержание списка и ассоциаций после интерференции в хорошем диапазоне.'
          : 'После нагрузки заметнее потеря деталей или ассоциативных связей.',
    },
  ];

  const rawIndex = avg(domains.map((d) => d.score));
  const indexValue = Number.isFinite(rawIndex) ? clampScore(rawIndex) : 50;
  const index = interpretationTrusted ? interpretIndex(indexValue) : degradedIndex(indexValue);

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

  const stabilizationTips: MicroRecommendation[] = [];
  patterns
    .filter((p) => p.active)
    .forEach((p) => {
      p.recommendations.forEach((t) => stabilizationTips.push({ text: t }));
    });
  if (!stabilizationTips.length) {
    stabilizationTips.push(
      { text: 'Сохранять чередование сосредоточенной работы 25–50 минут и короткое восстановление 5–10 минут.' },
      { text: 'Фиксировать один главный канал входящей информации в рабочем окне.' },
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
