import { SessionResult } from '../types';

const avg = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

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
};

const stroopInterference = (session: SessionResult): number => {
  const inc = session.stroop.trials.filter((t) => t.type === 'incongruent');
  const cong = session.stroop.trials.filter((t) => t.type === 'congruent');
  const incRt = avg(inc.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  const congRt = avg(cong.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  return Math.max(0, incRt - congRt);
};

const interpretIndex = (value: number): IndexInterpretation => {
  if (value >= 80) {
    return {
      value,
      bandKey: 'green',
      label: 'Высокая когнитивная устойчивость',
      description:
        'Внимание работает стабильно даже при нагрузке. Мозг хорошо удерживает темп обработки информации и устойчивость концентрации.',
      barColorClass: 'bg-emerald-600',
    };
  }
  if (value >= 60) {
    return {
      value,
      bandKey: 'lightGreen',
      label: 'Умеренно стабильное состояние',
      description:
        'В целом внимание работает устойчиво, но при высокой нагрузке начинают появляться признаки нестабильности.',
      barColorClass: 'bg-lime-500',
    };
  }
  if (value >= 40) {
    return {
      value,
      bandKey: 'yellow',
      label: 'Нестабильность под нагрузкой',
      description:
        'Сейчас внимание начинает быстрее терять устойчивость при когнитивной нагрузке и переключении контекста.',
      barColorClass: 'bg-amber-400',
    };
  }
  if (value >= 20) {
    return {
      value,
      bandKey: 'orange',
      label: 'Выраженная перегрузка внимания',
      description:
        'Мозг работает в режиме повышенной перегрузки. Устойчивость внимания и стабильность обработки информации снижены.',
      barColorClass: 'bg-orange-500',
    };
  }
  return {
    value,
    bandKey: 'red',
    label: 'Критически низкая устойчивость',
    description:
      'Сейчас внимание и устойчивость мышления работают нестабильно даже при умеренной нагрузке.',
    barColorClass: 'bg-red-600',
  };
};

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export const buildCognitiveAnalytics = (session: SessionResult): CognitiveAnalytics => {
  const m = {
    reactionMedianRt: session.reaction.medianRt,
    reactionCv: session.reaction.cv,
    reactionAnticipations: session.reaction.anticipations,
    flankerIncongruentAccuracy: session.flanker.incongruentAccuracy,
    flankerIncongruentCv: session.flanker.incongruentCv,
    stroopInterferenceMs: stroopInterference(session),
    stroopIncongruentErrorRate: session.stroop.incongruentErrorRate,
    stroopIncongruentCv: session.stroop.incongruentCv,
    wordDelayedScore: session.wordMemory.delayedScore,
    wordImmediateScore: session.wordMemory.immediateScore,
    wordDelta: session.wordMemory.immediateScore - session.wordMemory.delayedScore,
    faceNameScore: session.faceName.score,
  };

  const rtNorm = m.reactionMedianRt <= 320;
  const rtHighVar = m.reactionCv > 28;
  const attentionInstability =
    (rtHighVar && rtNorm) ||
    (m.flankerIncongruentCv > 32 && m.flankerIncongruentAccuracy >= 72);

  const switchingOverload =
    m.flankerIncongruentAccuracy < 72 || m.stroopInterferenceMs > 185;

  const retentionDrop = m.wordDelayedScore < 3 || m.wordDelta >= 2;

  const highReactivity =
    m.reactionAnticipations >= 3 ||
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
        'использовать режим одного фокуса',
        'снижать количество переключений внимания',
      ],
    },
    {
      id: 'switching_overload',
      title: 'Перегрузка переключением',
      active: switchingOverload,
      description: 'Мозг тратит слишком много ресурсов на обработку конкурирующей информации.',
      livedExperience: [
        'сложно удерживать фокус',
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
  const reactionSpeedScore = clampScore(115 - m.reactionMedianRt / 4.5);
  const reactionStabilityScore = clampScore(
    100 - m.reactionCv * 1.1 - m.reactionAnticipations * 6,
  );
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
          ? 'Удержание фокуса при конкурирующих стимулах в пределах нормы для короткой сессии.'
          : 'Точность и устойчивость внимания под конфликтом снижаются быстрее обычного.',
    },
    {
      key: 'reactionSpeed',
      title: 'Скорость реакции',
      score: reactionSpeedScore,
      shortDescription:
        reactionSpeedScore >= 70
          ? 'Темп обработки сигнала без лишней задержки.'
          : 'Темп ответа выше комфортного диапазона для ровной работы.',
    },
    {
      key: 'reactionStability',
      title: 'Стабильность реакции',
      score: reactionStabilityScore,
      shortDescription:
        reactionStabilityScore >= 70
          ? 'Мало разброса по времени реакции и мало преждевременных ответов.'
          : 'Вариативность реакций или преждевременные ответы повышают нестабильность.',
    },
    {
      key: 'cognitiveFlexibility',
      title: 'Когнитивная гибкость',
      score: flexibilityScore,
      shortDescription:
        flexibilityScore >= 70
          ? 'Конфликт «смысл vs цвет» обрабатывается без критического роста затрат.'
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

  const indexValue = clampScore(avg(domains.map((d) => d.score)));
  const index = interpretIndex(indexValue);

  const cognitiveExhaustion =
    m.reactionCv > 38 && m.reactionMedianRt > 360 && domains.filter((d) => d.score < 55).length >= 2;

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
  if (m.reactionCv > 30) drivers.push({ text: 'высокий информационный шум внутри задачи', weight: 2 });
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
      { text: 'Сохранять чередование фокуса 25–50 минут и короткое восстановление 5–10 минут.' },
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
  };
};
