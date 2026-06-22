import type { CognitiveDomainKey } from '../types';
import { getGranularIndexInterpretation } from './indexInterpretationBands';
import { getIndexCategory } from './indexCategory';
import type { CognitivePattern, OverloadMapItem } from './cognitiveAnalytics';
import { scoreAccentFromValue } from '../components/results/scoreAccent';
import {
  getOverloadMapWithTemporalTexts,
  getTemporalRecommendations,
  type TemporalOverloadCard,
} from './paidReportTemporal';

export type LeadingDeficit =
  | 'memory'
  | 'attention'
  | 'stability'
  | 'speed'
  | 'flexibility';

export type DomainScoresInput =
  | Record<CognitiveDomainKey, number>
  | { key: CognitiveDomainKey; score: number }[];

export type PaidReportExtendedBlock = {
  inLife: string;
  feeling: string;
  aboutResult: string;
};

export type PaidReportOverloadEntry = {
  id: string;
  title: string;
  active: boolean;
  description: string;
  example: string;
};

export type PaidReportData = {
  title: string;
  dateLabel: string;
  indexValue: number;
  indexLabel: string;
  indexAccent: string;
  extendedInterpretation: PaidReportExtendedBlock;
  leadingDeficitTitle: string;
  leadingDeficitKey: LeadingDeficit | null;
  overloadEntries: PaidReportOverloadEntry[];
  temporalOverloadCards: TemporalOverloadCard[];
  temporalRecommendations: string[];
  seriousRecommendations: string[];
  footerDisclaimer: string;
};

const DEFICIT_PRIORITY: CognitiveDomainKey[] = [
  'informationRetention',
  'attentionStability',
  'reactionStability',
  'reactionSpeed',
  'cognitiveFlexibility',
];

const DOMAIN_TO_DEFICIT: Record<CognitiveDomainKey, LeadingDeficit> = {
  informationRetention: 'memory',
  attentionStability: 'attention',
  reactionStability: 'stability',
  reactionSpeed: 'speed',
  cognitiveFlexibility: 'flexibility',
};

const LEADING_DEFICIT_TITLES: Record<LeadingDeficit, string> = {
  memory: 'Удержание информации',
  attention: 'Устойчивость внимания',
  stability: 'Стабильность реакции',
  speed: 'Скорость реакции',
  flexibility: 'Когнитивная гибкость',
};

const EXTENDED_BY_DEFICIT: Record<LeadingDeficit, PaidReportExtendedBlock> = {
  memory: {
    inLife:
      'Вы помните давнее, но свежее — то, что было минуты или часы назад — удерживаете хуже, чем хотелось бы. Важное только что услышали может «всплыть» с задержкой или вовсе потеряться.',
    feeling:
      'Бывает ощущение, что мысль была ясной секунду назад, а сейчас уже расплылась — без страха, скорее как сигнал, что мозгу нужен более спокойный ритм и меньше одновременных задач.',
    aboutResult:
      'Долговременная память, как правило, в порядке. Кратковременная даёт сбои. Это функция, которая зависит от сна, стресса и гидратации — и часто восстанавливается при заботе о режиме.',
  },
  attention: {
    inLife:
      'Вы можете сосредоточиться, если вокруг тихо и ничего не происходит. Но стоит появиться шуму, уведомлению или отвлечению — и вы теряете нить разговора или дела.',
    feeling:
      'Концентрация то собирается, то рассыпается — не паника, а ощущение, что внимание «плывёт», особенно когда вокруг много стимулов.',
    aboutResult:
      'Ваш мозг умеет фокусироваться, но хуже держит фокус при помехах. Это тренируется: меньше параллельных каналов, больше предсказуемых пауз.',
  },
  stability: {
    inLife:
      'Вы можете быть быстрым, но не ровным. Внимание «скачет»: то вы в потоке, то случается провал на несколько секунд.',
    feeling:
      'Внутри — рваный ритм: не постоянная усталость, а неровность, которую вы начинаете замечать к вечеру или после длинного блока работы.',
    aboutResult:
      'Мозг работает рывками. Часто это связано с давлением, сахаром или сном. Имеет смысл проверить эти три опоры в быту.',
  },
  speed: {
    inLife:
      'Вы стали чуть медленнее включаться в новые или неожиданные ситуации — с небольшой заминкой перед ответом или действием.',
    feeling:
      'Не «торможение», а будто мозг на долю секунды дольше «включается» — особенно когда задача непривычная или вокруг шум.',
    aboutResult:
      'Мозг работает, но включается чуть позже. Это часто связано со сном, водой и стрессом — и может восстанавливаться при более ровном режиме дня.',
  },
  flexibility: {
    inLife:
      'Вам трудно переключаться между делами. Если вас прервали — вы забываете, на чём остановились, и возвращение требует усилия.',
    feeling:
      'Лёгкое раздражение от смены контекста: хочется довести одно до конца, прежде чем открывать другое — иначе внутри ощущение «перегруза».',
    aboutResult:
      'Вы умеете глубоко погружаться, но труднее «выныривать». Это тренируется простым переключением каждые 20–30 минут и короткими якорями в заметках.',
  },
};

const SERIOUS_BY_DEFICIT: Record<LeadingDeficit, [string, string, string, string]> = {
  memory: [
    'Записывайте важные дела и мысли сразу — не полагайтесь на память в моменте.',
    'Попробуйте технику «якорь»: связывайте то, что хотите запомнить, с местом или действием.',
    'Повторяйте вслух то, что нельзя забыть: «я выключил утюг, я закрыл дверь».',
    'Вечером коротко сверяйтесь с заметками по важным делам — это снимает нагрузку с кратковременной памяти.',
  ],
  attention: [
    'Уберите фоновый шум при работе: наушники с белым шумом или тишина.',
    'Делайте одно дело за раз — многозадачность снижает устойчивость внимания.',
    'Попробуйте технику «помодоро»: 25 минут работы, 5 минут отдыха.',
    'Перед сложным блоком на минуту уберите лишние вкладки и уведомления — так проще удержать нить.',
  ],
  stability: [
    'Проверьте давление и уровень сахара — они часто дают эффект «скачков» внимания.',
    'Старайтесь спать не меньше 7 часов: недосып усиливает неровность темпа.',
    'Избегайте резких переключений между делами — давайте мозгу короткую паузу.',
    'Чередуйте сосредоточенную работу и 3–5 минут без экрана — ритм станет ровнее.',
  ],
  speed: [
    'Пейте воду в течение дня: обезвоживание замедляет включение в задачу.',
    'Добавьте короткие физические разминки каждые 1–2 часа — это «разгоняет» мозг.',
    'Не торопите себя: короткая пауза перед ответом часто возвращает точность.',
    'Начинайте сложные дела в первой половине дня, когда темп обычно выше.',
  ],
  flexibility: [
    'Заведите привычку каждые 20–30 минут менять вид деятельности (даже просто встать и пройтись).',
    'Не делайте несколько дел сразу — мозгу трудно переключаться.',
    'Записывайте, на чём остановились, перед тем как отвлечься — так проще вернуться.',
    'Завершайте микро-шаг, прежде чем открывать новую вкладку или чат.',
  ],
};

const OVERLOAD_STATIC: Record<
  string,
  { title: string; description: string; example: string }
> = {
  switch: {
    title: 'Перегрузка переключением',
    description:
      'Мозг тратит лишние усилия, когда нужно переключаться между задачами или отвлекаться и возвращаться.',
    example:
      'Вас прервали — и вы забыли, на чём остановились. Трудно делать два дела сразу (например, говорить и печатать).',
  },
  unstable_attention: {
    title: 'Нестабильность внимания',
    description:
      'Вы можете быть быстрым, но при этом нестабильным. Внимание «скачет»: то в потоке, то провал.',
    example:
      'Чувствуете, что концентрация плавает. В разговоре или мыслях случаются небольшие паузы, когда вы будто «не здесь».',
  },
  reactivity: {
    title: 'Высокая реактивность',
    description: 'Мозг торопится ответить раньше, чем успел обработать информацию.',
    example:
      'Иногда отвечаете или делаете что-то быстро, а потом понимаете, что ошиблись. Хочется нажать, не дожидаясь полной ясности.',
  },
  exhaustion: {
    title: 'Когнитивное истощение',
    description:
      'Умственная задача даётся тяжелее, чем раньше. К концу дня или долгого занятия сложнее сохранять точность.',
    example:
      'К вечеру тяжело сосредоточиться. После 20 минут чтения или работы за экраном — уже хочется отвлечься.',
  },
  load_resistance: {
    title: 'Снижение устойчивости под нагрузкой',
    description: 'Сразу несколько процессов «проседают», когда нагрузка растёт.',
    example:
      'Если нужно одновременно запомнить, понять и быстро ответить — качество падает сильнее. Чувствуете себя «выжатым» после непродолжительной умственной работы.',
  },
  retention_drop: {
    title: 'Снижение устойчивости удержания информации',
    description:
      'Информация становится менее устойчивой к интерференции и быстрее теряется под нагрузкой.',
    example:
      'Свежее забывается быстрее: детали разговора или только что прочитанное распадаются, если сразу переключиться на другое.',
  },
};

const FOOTER_DISCLAIMER =
  'Данные хранятся только на вашем устройстве. Отчёт не является медицинским заключением.';

function normalizeDomainScores(input: DomainScoresInput): Record<CognitiveDomainKey, number> {
  if (Array.isArray(input)) {
    return Object.fromEntries(input.map((d) => [d.key, d.score])) as Record<CognitiveDomainKey, number>;
  }
  return input;
}

function safeScore(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 50;
}

/**
 * Ведущий дефицит: минимальный балл; при равенстве — память → внимание → стабильность → скорость → гибкость.
 */
export function getLeadingDeficit(domainScores: DomainScoresInput): LeadingDeficit | null {
  const scores = normalizeDomainScores(domainScores);
  let chosen: CognitiveDomainKey | null = null;
  let minScore = Infinity;

  for (const key of DEFICIT_PRIORITY) {
    const s = safeScore(scores[key]);
    if (s < minScore) {
      minScore = s;
      chosen = key;
    }
  }

  return chosen ? DOMAIN_TO_DEFICIT[chosen] : null;
}

/** Все домены с минимальным баллом (для ничьей — несколько ведущих дефицитов). */
export function getLeadingDeficits(domainScores: DomainScoresInput): LeadingDeficit[] {
  const scores = normalizeDomainScores(domainScores);
  let minScore = Infinity;

  for (const key of DEFICIT_PRIORITY) {
    minScore = Math.min(minScore, safeScore(scores[key]));
  }

  const deficits: LeadingDeficit[] = [];
  for (const key of DEFICIT_PRIORITY) {
    if (safeScore(scores[key]) === minScore) {
      deficits.push(DOMAIN_TO_DEFICIT[key]);
    }
  }
  return deficits;
}

function buildOverloadEntries(
  activePatterns: CognitivePattern[],
  overloadMap: OverloadMapItem[],
): PaidReportOverloadEntry[] {
  const entries: PaidReportOverloadEntry[] = [];
  const seen = new Set<string>();

  for (const item of overloadMap) {
    const staticCopy = OVERLOAD_STATIC[item.id];
    if (!staticCopy) continue;
    seen.add(item.id);
    entries.push({
      id: item.id,
      title: staticCopy.title,
      active: item.active,
      description: staticCopy.description,
      example: staticCopy.example,
    });
  }

  if (activePatterns.some((p) => p.id === 'retention_drop' && p.active) && !seen.has('retention_drop')) {
    const copy = OVERLOAD_STATIC.retention_drop;
    entries.push({
      id: 'retention_drop',
      title: copy.title,
      active: true,
      description: copy.description,
      example: copy.example,
    });
  }

  return entries.filter((e) => e.active);
}

function padRecommendations(items: string[], count = 4): string[] {
  const out = [...items];
  while (out.length < count) {
    out.push('Сохраняйте привычный ритм работы и отдыха — резких перестроек не требуется.');
  }
  return out.slice(0, count);
}

export function getPaidReportData(
  index: number,
  domainScores: DomainScoresInput,
  activePatterns: CognitivePattern[],
  leadingDeficitInput?: LeadingDeficit | null,
  overloadMap: OverloadMapItem[] = [],
): PaidReportData {
  const indexValue = Math.max(0, Math.min(100, Math.round(Number.isFinite(index) ? index : 50)));
  const band = getGranularIndexInterpretation(indexValue);
  const leadingKey = leadingDeficitInput ?? getLeadingDeficit(domainScores);

  const highIndex = indexValue >= 70;

  const extendedInterpretation: PaidReportExtendedBlock = highIndex
    ? {
        inLife: band.description,
        feeling:
          'Сейчас ресурс внимания в целом ровный; отдельные «узкие места» могут проявляться при усталости или длинных блоках нагрузки.',
        aboutResult: band.overloadMapIntro,
      }
    : leadingKey
      ? EXTENDED_BY_DEFICIT[leadingKey]
      : {
          inLife: band.description,
          feeling: 'Сейчас ощущения зависят от ритма дня и нагрузки — это снимок момента, а не приговор.',
          aboutResult: band.overloadMapIntro,
        };

  const seriousRecommendations = highIndex
    ? padRecommendations(band.recommendations)
    : leadingKey
      ? [...SERIOUS_BY_DEFICIT[leadingKey]]
      : padRecommendations(band.recommendations);

  return {
    title: 'Персональный когнитивный отчёт — Corta',
    dateLabel: new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    indexValue,
    indexLabel: getIndexCategory(indexValue).category,
    indexAccent: scoreAccentFromValue(indexValue),
    extendedInterpretation,
    leadingDeficitTitle: leadingKey ? LEADING_DEFICIT_TITLES[leadingKey] : 'Сбалансированный профиль',
    leadingDeficitKey: leadingKey,
    overloadEntries: buildOverloadEntries(activePatterns, overloadMap),
    temporalOverloadCards: getOverloadMapWithTemporalTexts(overloadMap),
    temporalRecommendations: getTemporalRecommendations(leadingKey, domainScores),
    seriousRecommendations,
    footerDisclaimer: FOOTER_DISCLAIMER,
  };
}

/** @deprecated Используйте getPaidReportData */
export function generatePersonalizedInterpretation(
  index: number,
  domainScores: DomainScoresInput,
): ReturnType<typeof getPaidReportData> {
  return getPaidReportData(index, domainScores, [], null, []);
}
