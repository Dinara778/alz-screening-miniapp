/**
 * «Животное дня» — единственный источник текстов и правил выбора.
 * Индекс влияет только на вторую строку; животное — только по доменам.
 */

import type { CognitiveDomainKey } from '../types';
import type { OverloadMapItem } from '../utils/cognitiveAnalytics';

export type AnimalId =
  | 'panther'
  | 'panda'
  | 'capybara'
  | 'owl'
  | 'fox'
  | 'octopus'
  | 'squirrel'
  | 'hummingbird'
  | 'cat';

export type AnimalDomainInputs = {
  attention: number;
  stability: number;
  energy: number;
  overload: number;
  memory: number;
  speed: number;
  flexibility: number;
  dominanceGap: number;
};

export type AnimalOfTheDayCard = {
  animalId: AnimalId;
  emoji: string;
  /** Имя животного для заголовка («Пантера») */
  animalLabel: string;
  /** Фиксированная строка целиком */
  fixedLine: string;
  /** Вторая строка — только от индекса */
  indexLine: string;
};

type IndexBand =
  | '90-100'
  | '80-89'
  | '70-79'
  | '60-69'
  | '50-59'
  | '40-49'
  | '25-39'
  | '0-24';

const ANIMAL_EMOJI: Record<AnimalId, string> = {
  panther: '🐆',
  panda: '🐼',
  capybara: '🦫',
  owl: '🦉',
  fox: '🦊',
  octopus: '🐙',
  squirrel: '🐿',
  hummingbird: '🐦',
  cat: '🐈',
};

const ANIMAL_LABEL: Record<AnimalId, string> = {
  panther: 'Пантера',
  panda: 'Панда',
  capybara: 'Капибара',
  owl: 'Сова',
  fox: 'Лиса',
  octopus: 'Осьминог',
  squirrel: 'Белка',
  hummingbird: 'Колибри',
  cat: 'Кот',
};

const FIXED_LINES: Record<AnimalId, string> = {
  panther: 'Ты сегодня — Пантера. Спокойная сила и точный фокус.',
  panda: 'Ты сегодня — Панда. Мягкий режим и только важное.',
  owl: 'Ты сегодня — Сова. Глубина важнее скорости.',
  fox: 'Ты сегодня — Лиса. Быстро, гибко, точно.',
  octopus: 'Ты сегодня — Осьминог. Несколько потоков одновременно.',
  squirrel: 'Ты сегодня — Белка. Замечаешь всё и сразу.',
  capybara: 'Ты сегодня — Капибара. Спокойный устойчивый ритм.',
  hummingbird: 'Ты сегодня — Колибри. Много энергии, разный фокус.',
  cat: 'Ты сегодня — Кот. Спокойный и устойчивый ритм.',
};

const INDEX_LINES: Record<AnimalId, Record<IndexBand, string>> = {
  panther: {
    '90-100': 'Ты сейчас в редком режиме: всё под контролем, даже хаос.',
    '80-89': 'Всё чётко. Лишний шум просто не попадает в систему.',
    '70-79': 'Норм фокус. Без лишних отвлечений.',
    '60-69': 'Фокус есть, но не дави на себя.',
    '50-59': 'Лучше двигаться медленнее, чем ломать ритм.',
    '40-49': 'Сейчас важно не перегружать систему.',
    '25-39': 'Минимум действий. Максимум экономии.',
    '0-24': 'Сегодня не про скорость. Сегодня про восстановление.',
  },
  panda: {
    '90-100': 'Редкий случай: ты в ресурсе и без суеты.',
    '80-89': 'Спокойно справляешься без лишнего напряжения.',
    '70-79': 'Норм день. Без рывков.',
    '60-69': 'Просто делай меньше — и всё будет ок.',
    '50-59': 'Режим «бережно к себе» включён.',
    '40-49': 'Лучше не ускоряться вообще.',
    '25-39': 'Только самое необходимое.',
    '0-24': 'Полный режим восстановления.',
  },
  owl: {
    '90-100': 'Ты сейчас думаешь так глубоко, что можно потеряться без карты.',
    '80-89': 'У тебя включился режим «разберусь в сути и в жизни».',
    '70-79': 'Норм мысли. Медленно, но с смыслом.',
    '60-69': 'Думаешь как через толщу воды, но точно.',
    '50-59': 'Лучше не перегружать сложными задачами.',
    '40-49': 'Только простые задачи.',
    '25-39': 'Минимум стимулов.',
    '0-24': 'Мозгу нужна пауза.',
  },
  fox: {
    '90-100': 'Ты уже понял(а) всё раньше других.',
    '80-89': 'Быстрое мышление работает отлично.',
    '70-79': 'Норм темп.',
    '60-69': 'Не распыляйся.',
    '50-59': 'Меньше решений — лучше результат.',
    '40-49': 'Замедлись и упростись.',
    '25-39': 'Только базовые действия.',
    '0-24': 'Никакой спешки сегодня.',
  },
  octopus: {
    '90-100': 'Ты держишь всё сразу и не теряешься.',
    '80-89': 'Много задач, но справляешься.',
    '70-79': 'Не добавляй новое.',
    '60-69': 'Сократи потоки.',
    '50-59': 'Один поток за раз.',
    '40-49': 'Максимально упростить.',
    '25-39': 'Только одно дело.',
    '0-24': 'Стоп многозадачности.',
  },
  squirrel: {
    '90-100': 'Ты видишь всё. Даже лишнее.',
    '80-89': 'Много сигналов вокруг.',
    '70-79': 'Фокус скачет, но ловишь.',
    '60-69': 'Ой… отвлёкся(ась).',
    '50-59': 'Трудно удерживать внимание.',
    '40-49': 'Всё слишком шумно.',
    '25-39': 'Минимум стимулов.',
    '0-24': 'Только тишина.',
  },
  capybara: {
    '90-100': 'Редкий идеальный баланс.',
    '80-89': 'Спокойный стабильный день.',
    '70-79': 'Всё ровно.',
    '60-69': 'Уже хорошо, что без перегруза.',
    '50-59': 'Замедление — это ок.',
    '40-49': 'Убираем лишнее.',
    '25-39': 'Только базовые действия.',
    '0-24': 'Восстановление.',
  },
  hummingbird: {
    '90-100': 'Всё успеваешь, даже не понимая как.',
    '80-89': 'Много энергии — направь.',
    '70-79': 'Летаешь между задачами.',
    '60-69': 'Слишком много переключений.',
    '50-59': 'Замедли поток.',
    '40-49': 'Упростить маршрут.',
    '25-39': 'Один фокус.',
    '0-24': 'Пауза.',
  },
  cat: {
    '90-100': 'Спокойная продуктивность.',
    '80-89': 'Всё мягко и ровно.',
    '70-79': 'Нормальный день.',
    '60-69': 'Без перегрузки.',
    '50-59': 'Медленный режим тоже режим.',
    '40-49': 'Не спеши.',
    '25-39': 'Минимум задач.',
    '0-24': 'Отдых.',
  },
};

const DOMAIN_KEYS: CognitiveDomainKey[] = [
  'attentionStability',
  'reactionStability',
  'reactionSpeed',
  'cognitiveFlexibility',
  'informationRetention',
];

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function indexToBand(index: number): IndexBand {
  const v = clampScore(index);
  if (v >= 90) return '90-100';
  if (v >= 80) return '80-89';
  if (v >= 70) return '70-79';
  if (v >= 60) return '60-69';
  if (v >= 50) return '50-59';
  if (v >= 40) return '40-49';
  if (v >= 25) return '25-39';
  return '0-24';
}

function allInRange(values: number[], min: number, max: number): boolean {
  return values.every((v) => v >= min && v <= max);
}

function matchesPanther(d: AnimalDomainInputs): boolean {
  return d.attention > 80 && d.stability > 75 && d.energy > 75 && d.overload < 50;
}

function matchesPanda(d: AnimalDomainInputs): boolean {
  return d.energy < 35 && d.overload > 70;
}

function matchesCapybara(d: AnimalDomainInputs): boolean {
  const core = [d.attention, d.stability, d.speed, d.flexibility, d.memory];
  return allInRange(core, 60, 80) && d.dominanceGap < 8;
}

function matchesOwl(d: AnimalDomainInputs): boolean {
  return d.attention >= 75 && d.memory >= 70;
}

function matchesFox(d: AnimalDomainInputs): boolean {
  return d.speed >= 75 && d.flexibility >= 70;
}

function matchesOctopus(d: AnimalDomainInputs): boolean {
  return d.flexibility >= 75 && d.speed >= 70 && d.attention >= 50 && d.attention <= 75;
}

function matchesSquirrel(d: AnimalDomainInputs): boolean {
  return d.attention < 60 && d.overload >= 60 && d.stability < 65;
}

function matchesHummingbird(d: AnimalDomainInputs): boolean {
  return d.energy > 75 && d.speed > 75 && d.attention < 65;
}

function matchesCat(d: AnimalDomainInputs): boolean {
  const core = [d.attention, d.stability, d.speed, d.flexibility, d.memory];
  return allInRange(core, 50, 75) && d.overload < 50;
}

/** Порядок: от более специфичных правил к общему fallback (кот). */
function selectAnimalId(d: AnimalDomainInputs): AnimalId {
  if (matchesPanther(d)) return 'panther';
  if (matchesPanda(d)) return 'panda';
  if (matchesHummingbird(d)) return 'hummingbird';
  if (matchesSquirrel(d)) return 'squirrel';
  if (matchesOwl(d)) return 'owl';
  if (matchesFox(d)) return 'fox';
  if (matchesOctopus(d)) return 'octopus';
  if (matchesCapybara(d)) return 'capybara';
  if (matchesCat(d)) return 'cat';
  return 'cat';
}

function indexLineForAnimal(animalId: AnimalId, index: number): string {
  return INDEX_LINES[animalId][indexToBand(index)];
}

/** Собирает входы для правил из баллов доменов (без индекса). */
export function buildAnimalDomainInputs(
  domainScores: { key: CognitiveDomainKey; score: number }[],
  overloadMap: OverloadMapItem[],
): AnimalDomainInputs {
  const score = (key: CognitiveDomainKey) =>
    clampScore(domainScores.find((d) => d.key === key)?.score ?? 50);

  const attention = score('attentionStability');
  const stability = score('reactionStability');
  const speed = score('reactionSpeed');
  const flexibility = score('cognitiveFlexibility');
  const memory = score('informationRetention');
  const energy = clampScore((speed + stability) / 2);

  const activeZones = overloadMap.filter((z) => z.active).length;
  const overload = clampScore((activeZones / 6) * 100);

  const coreScores = DOMAIN_KEYS.map((k) => score(k));
  const dominanceGap = Math.max(...coreScores) - Math.min(...coreScores);

  return {
    attention,
    stability,
    energy,
    overload,
    memory,
    speed,
    flexibility,
    dominanceGap,
  };
}

/** Карточка «Животное дня»: животное по доменам, вторая строка — по индексу. */
export function resolveAnimalOfTheDay(
  domainInputs: AnimalDomainInputs,
  index: number,
): AnimalOfTheDayCard {
  const animalId = selectAnimalId(domainInputs);
  return {
    animalId,
    emoji: ANIMAL_EMOJI[animalId],
    animalLabel: ANIMAL_LABEL[animalId],
    fixedLine: FIXED_LINES[animalId],
    indexLine: indexLineForAnimal(animalId, index),
  };
}

export function buildAnimalOfTheDayCard(
  domainScores: { key: CognitiveDomainKey; score: number }[],
  overloadMap: OverloadMapItem[],
  index: number,
): AnimalOfTheDayCard {
  const inputs = buildAnimalDomainInputs(domainScores, overloadMap);
  return resolveAnimalOfTheDay(inputs, index);
}
