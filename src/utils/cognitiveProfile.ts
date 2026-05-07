import { SessionResult } from '../types';

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

const avg = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export const buildCognitiveProfile = (session: SessionResult): CognitiveProfile => {
  const domains: DomainProfile[] = [];

  const delayed = session.wordMemory.delayedScore;
  const delta = session.wordMemory.immediateScore - session.wordMemory.delayedScore;
  if (delayed >= 4 && delta <= 1) {
    domains.push({
      key: 'wordMemory',
      title: 'Удержание информации после переключения внимания',
      level: 'strong',
      score: 95,
      interpretation:
        'Мозг хорошо удерживает информацию даже после переключения внимания.',
      recommendations: [
        'Поддерживайте текущий режим фокус-сессий и пауз.',
      ],
      metrics: [`Отсроченно: ${delayed}/5`, `Потеря после переключения: ${delta}`],
      overloaded: false,
    });
  } else if (delayed === 3 || delta === 2) {
    domains.push({
      key: 'wordMemory',
      title: 'Удержание информации после переключения внимания',
      level: 'watch',
      score: 70,
      interpretation:
        'При нагрузке часть информации начинает теряться. Это часто связано с перегрузкой, усталостью и большим количеством переключений внимания.',
      recommendations: [
        'Уменьшить многозадачность.',
        'Работать короткими фокус-сессиями.',
        'Сократить постоянные переключения.',
        'Тренировать удержание информации.',
      ],
      metrics: [`Отсроченно: ${delayed}/5`, `Потеря после переключения: ${delta}`],
      overloaded: false,
    });
  } else {
    domains.push({
      key: 'wordMemory',
      title: 'Удержание информации после переключения внимания',
      level: 'overload',
      score: 40,
      interpretation:
        'Мозгу сложно стабильно удерживать новую информацию после отвлечения. В повседневной жизни это может ощущаться как забывание деталей, выпадение мыслей и необходимость повторно возвращаться к информации.',
      recommendations: [
        'Уменьшить многозадачность.',
        'Работать короткими фокус-сессиями.',
        'Сократить постоянные переключения.',
        'Тренировать удержание информации.',
      ],
      metrics: [`Отсроченно: ${delayed}/5`, `Потеря после переключения: ${delta}`],
      overloaded: true,
    });
  }

  const flankerAcc = session.flanker.incongruentAccuracy;
  const flankerCv = session.flanker.incongruentCv;
  if (flankerAcc >= 85 && flankerCv <= 25) {
    domains.push({
      key: 'flanker',
      title: 'Стабильность внимания под нагрузкой',
      level: 'strong',
      score: 95,
      interpretation: 'Внимание работает стабильно даже при отвлекающих стимулах.',
      recommendations: ['Сохраняйте текущий режим концентрации.'],
      metrics: [`Точность: ${flankerAcc.toFixed(1)}%`, `Вариативность: ${flankerCv.toFixed(1)}%`],
      overloaded: false,
    });
  } else if (
    (flankerAcc >= 70 && flankerAcc <= 84) ||
    (flankerCv >= 26 && flankerCv <= 40)
  ) {
    domains.push({
      key: 'flanker',
      title: 'Стабильность внимания под нагрузкой',
      level: 'watch',
      score: 70,
      interpretation:
        'Под нагрузкой внимание начинает работать менее стабильно. Возможны скачки концентрации и повышенная утомляемость от большого количества стимулов.',
      recommendations: [
        'Уменьшить количество параллельных стимулов.',
        'Избегать постоянного переключения контекста.',
        'Использовать циклы глубокой концентрации.',
        'Снижать информационный шум.',
      ],
      metrics: [`Точность: ${flankerAcc.toFixed(1)}%`, `Вариативность: ${flankerCv.toFixed(1)}%`],
      overloaded: false,
    });
  } else {
    domains.push({
      key: 'flanker',
      title: 'Стабильность внимания под нагрузкой',
      level: 'overload',
      score: 40,
      interpretation:
        'Мозг может работать быстро, но нестабильно. Это может проявляться как ощущение перегруженности, ошибки в простых задачах и резкие колебания концентрации.',
      recommendations: [
        'Уменьшить количество параллельных стимулов.',
        'Избегать постоянного переключения контекста.',
        'Использовать циклы глубокой концентрации.',
        'Снижать информационный шум.',
      ],
      metrics: [`Точность: ${flankerAcc.toFixed(1)}%`, `Вариативность: ${flankerCv.toFixed(1)}%`],
      overloaded: true,
    });
  }

  const reactionCv = session.reaction.cv;
  const anticip = session.reaction.anticipations;
  const reactionRecs = [
    'Восстановление режима сна.',
    'Уменьшение переутомления.',
    'Снижение информационной перегрузки.',
    'Тренировка устойчивого внимания.',
  ];
  let reactionInterpretation = '';
  let reactionLevel: DomainLevel = 'watch';
  let reactionScore = 70;
  let reactionOverloaded = false;
  if (reactionCv <= 20 && anticip <= 1) {
    reactionInterpretation = 'Скорость обработки информации остаётся стабильной и ровной.';
    reactionLevel = 'strong';
    reactionScore = 95;
  } else if ((reactionCv >= 21 && reactionCv <= 35) || (anticip >= 2 && anticip <= 3)) {
    reactionInterpretation = 'Когнитивный темп начинает становиться менее стабильным при нагрузке и усталости.';
  } else {
    reactionInterpretation =
      'Скорость реакции заметно колеблется. Это часто ощущается как нестабильная продуктивность, скачки концентрации и быстрое когнитивное истощение.';
    reactionLevel = 'overload';
    reactionScore = 40;
    reactionOverloaded = true;
  }
  if (anticip > 3) {
    reactionInterpretation +=
      ' Также наблюдается повышенная импульсивность реакций — склонность отвечать раньше полной обработки информации.';
  }
  domains.push({
    key: 'reaction',
    title: 'Стабильность когнитивного темпа',
    level: reactionLevel,
    score: reactionScore,
    interpretation: reactionInterpretation,
    recommendations: reactionRecs,
    metrics: [`CV: ${reactionCv.toFixed(1)}%`, `Преждевременные реакции: ${anticip}`],
    overloaded: reactionOverloaded,
  });

  const stroopInc = session.stroop.trials.filter((t) => t.type === 'incongruent');
  const stroopCong = session.stroop.trials.filter((t) => t.type === 'congruent');
  const incRt = avg(stroopInc.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  const congRt = avg(stroopCong.filter((t) => t.correct && t.rt !== null).map((t) => t.rt as number));
  const interference = Math.max(0, incRt - congRt);
  const stroopErr = session.stroop.incongruentErrorRate;
  const stroopCv = session.stroop.incongruentCv;
  const stroopRecs = [
    'Уменьшить многозадачность.',
    'Дозировать информационную нагрузку.',
    'Чередовать концентрацию и восстановление.',
    'Тренировать когнитивную гибкость.',
  ];

  if (interference <= 150 && stroopErr <= 10 && stroopCv <= 25) {
    domains.push({
      key: 'stroop',
      title: 'Когнитивная гибкость',
      level: 'strong',
      score: 95,
      interpretation:
        'Мозг хорошо сохраняет точность и устойчивость в условиях конфликтной информации.',
      recommendations: ['Сохраняйте текущий режим управления нагрузкой.'],
      metrics: [
        `Interference: ${interference.toFixed(0)} мс`,
        `Ошибки: ${stroopErr.toFixed(1)}%`,
        `Вариативность: ${stroopCv.toFixed(1)}%`,
      ],
      overloaded: false,
    });
  } else if (
    (interference >= 151 && interference <= 250) ||
    (stroopErr >= 11 && stroopErr <= 25) ||
    (stroopCv >= 26 && stroopCv <= 45)
  ) {
    domains.push({
      key: 'stroop',
      title: 'Когнитивная гибкость',
      level: 'watch',
      score: 70,
      interpretation:
        'При высокой когнитивной нагрузке мозгу требуется больше ресурсов для удержания точности и подавления отвлекающей информации.',
      recommendations: stroopRecs,
      metrics: [
        `Interference: ${interference.toFixed(0)} мс`,
        `Ошибки: ${stroopErr.toFixed(1)}%`,
        `Вариативность: ${stroopCv.toFixed(1)}%`,
      ],
      overloaded: false,
    });
  } else {
    domains.push({
      key: 'stroop',
      title: 'Когнитивная гибкость',
      level: 'overload',
      score: 40,
      interpretation:
        'В сложных задачах внимание начинает работать нестабильно. Это может проявляться как ощущение перегруженности, сложности с переключением и повышенная утомляемость.',
      recommendations: stroopRecs,
      metrics: [
        `Interference: ${interference.toFixed(0)} мс`,
        `Ошибки: ${stroopErr.toFixed(1)}%`,
        `Вариативность: ${stroopCv.toFixed(1)}%`,
      ],
      overloaded: true,
    });
  }

  const face = session.faceName.score;
  if (face === 3) {
    domains.push({
      key: 'faceName',
      title: 'Ассоциативное удержание информации',
      level: 'strong',
      score: 95,
      interpretation:
        'Мозг хорошо формирует и удерживает новые ассоциативные связи.',
      recommendations: ['Поддерживайте текущий режим усвоения информации.'],
      metrics: [`Точность: ${face}/3`],
      overloaded: false,
    });
  } else if (face === 2) {
    domains.push({
      key: 'faceName',
      title: 'Ассоциативное удержание информации',
      level: 'watch',
      score: 70,
      interpretation:
        'При высокой нагрузке удержание новых ассоциаций может становиться менее стабильным.',
      recommendations: [
        'Использовать смысловые ассоциации.',
        'Уменьшать фоновую перегрузку.',
        'Тренировать удержание контекста.',
        'Использовать визуальное кодирование информации.',
      ],
      metrics: [`Точность: ${face}/3`],
      overloaded: false,
    });
  } else {
    domains.push({
      key: 'faceName',
      title: 'Ассоциативное удержание информации',
      level: 'overload',
      score: 40,
      interpretation:
        'Мозгу сложнее удерживать новые ассоциативные связи. В жизни это может ощущаться как забывание имён, контекста разговоров и новых деталей.',
      recommendations: [
        'Использовать смысловые ассоциации.',
        'Уменьшать фоновую перегрузку.',
        'Тренировать удержание контекста.',
        'Использовать визуальное кодирование информации.',
      ],
      metrics: [`Точность: ${face}/3`],
      overloaded: true,
    });
  }

  const overloadIndicators = domains.filter((d) => d.overloaded).length;
  const cognitiveStabilityIndex = Math.max(
    0,
    Math.min(100, Math.round(avg(domains.map((d) => d.score)))),
  );

  let overloadText =
    'Когнитивная система работает стабильно. Есть отдельные зоны утомления, но общая устойчивость сохраняется.';
  if (overloadIndicators >= 2 && overloadIndicators <= 3) {
    overloadText =
      'Мозг начинает терять стабильность под нагрузкой. Это может влиять на концентрацию, ясность мышления и когнитивную выносливость.';
  } else if (overloadIndicators >= 4) {
    overloadText =
      'Нагрузка и истощение уже заметно влияют на качество работы внимания и памяти. Обычно в таком состоянии люди ощущают когнитивную усталость и перегруженность.';
  }

  return {
    cognitiveStabilityIndex,
    overloadIndicators,
    overloadText,
    domains,
    strengths: domains.filter((d) => d.level === 'strong').map((d) => d.title),
    overloadZones: domains.filter((d) => d.level === 'overload').map((d) => d.title),
  };
};
