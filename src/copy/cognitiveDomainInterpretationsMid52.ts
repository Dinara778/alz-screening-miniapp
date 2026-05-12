import type { CognitiveDomainKey } from '../types';

/** Тексты интерпретаций доменов для типичного «среднего» профиля (~52/100 по индексу), аудитория 40+. */
export type DomainInterpretationCopy = {
  inLife: string;
  manifestations: string;
  aboutResult: string;
};

const ATTENTION: DomainInterpretationCopy = {
  inLife:
    'Вы можете сосредоточиться, если ничего не мешает. Но стоит появиться шуму, уведомлению или кто-то заговорит — внимание переключается.',
  manifestations:
    'Читаете статью и ловите себя на том, что думаете о другом. Смотрели фильм, а детали сюжета уже вылетели. Легко отвлекаетесь на посторонние звуки или движения.',
  aboutResult: 'Насколько хорошо вы сохраняете фокус, когда вокруг что-то происходит.',
};

const SPEED: DomainInterpretationCopy = {
  inLife: 'Как быстро вы включаетесь в новую или неожиданную ситуацию.',
  manifestations:
    'Вам нужно чуть больше времени, чем раньше, чтобы понять, что сказали в шумном месте. Иногда ловите себя на лёгкой заминке перед ответом. Если задача новая — приходится на секунду «зависнуть», прежде чем сообразить.',
  aboutResult: 'Насколько быстро вы реагируете на изменения вокруг.',
};

const STABILITY: DomainInterpretationCopy = {
  inLife:
    'Ровность вашего темпа. Вы можете быть не медленным, но с провалами: то быстро, то вдруг зависание.',
  manifestations:
    'Чувствуете, что внимание «скачет» — то вы в потоке, то неожиданно «выпадаете» на несколько секунд. В разговоре случаются небольшие паузы, когда вы будто не здесь. При этом в целом вам не кажется, что вы сильно заторможены.',
  aboutResult: 'Насколько ровно вы работаете без резких провалов внимания.',
};

const FLEX: DomainInterpretationCopy = {
  inLife: 'Умение переключаться между делами и адаптироваться, если что-то пошло не по плану.',
  manifestations:
    'Трудно делать два дела сразу (например, говорить и печатать). Если вас прервали — забываете, на чём остановились. Новый интерфейс в телефоне вызывает лёгкое раздражение, нужно время, чтобы привыкнуть.',
  aboutResult: 'Как легко вы переключаетесь и меняете стратегию.',
};

const RETENTION: DomainInterpretationCopy = {
  inLife:
    'Память на то, что было минуты или часы назад. Не лица из детства, а что вы только что делали, говорили или слышали.',
  manifestations:
    'Зашли в комнату и забыли, зачем. Положили ключи или очки в «особое место» — и не можете вспомнить, куда. Через пару часов после обеда с трудом вспоминаете, что именно ели. Собеседник назвал имя — и через минуту оно вылетело.',
  aboutResult: 'Насколько хорошо вы удерживаете свежие события и детали.',
};

export const DOMAIN_INTERPRETATION_MID_52: Record<CognitiveDomainKey, DomainInterpretationCopy> = {
  attentionStability: ATTENTION,
  reactionSpeed: SPEED,
  reactionStability: STABILITY,
  cognitiveFlexibility: FLEX,
  informationRetention: RETENTION,
};

export const getDomainInterpretationMid52 = (key: CognitiveDomainKey): DomainInterpretationCopy =>
  DOMAIN_INTERPRETATION_MID_52[key];

/** Для PDF и строковых полей профиля. */
export const formatDomainInterpretationPlain = (copy: DomainInterpretationCopy): string =>
  [
    `В жизни: ${copy.inLife}`,
    `Как проявляется: ${copy.manifestations}`,
    `О чём говорит результат: ${copy.aboutResult}`,
  ].join('\n');
