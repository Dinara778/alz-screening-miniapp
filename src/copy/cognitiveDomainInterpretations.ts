import type { CognitiveDomainKey } from '../types';

export type DomainInterpretationCopy = {
  inLife: string;
  manifestations: string;
  aboutResult: string;
};

const ATTENTION: DomainInterpretationCopy = {
  inLife:
    'Вы можете сосредоточиться, если вокруг тихо и ничего не происходит. Но стоит появиться шуму или отвлечению — и вы теряете нить.',
  manifestations:
    'Читаете статью и не помните ни слова. Смотрите фильм, а детали вылетают. В разговоре ловите себя на мысли о своём. Отвечаете коллеге и уже через минуту забываете, о чём он вас спросил.',
  aboutResult:
    'Ваш мозг умеет фокусироваться, но не умеет держать фокус при помехах. Это тренируется.',
};

const SPEED: DomainInterpretationCopy = {
  inLife:
    'Вы стали чуть медленнее включаться в новые или неожиданные ситуации. С небольшой заминкой.',
  manifestations:
    'Зависаете на пару секунд перед ответом. В шумном месте вам сложнее понять собеседника. За рулём вам нужно чуть больше времени на реакцию. На неожиданный вопрос вы отвечаете не сразу, а после короткой паузы.',
  aboutResult:
    'Мозг работает, но включается чуть позже. Это часто связано со сном, водой, стрессом — и восстанавливается.',
};

const STABILITY: DomainInterpretationCopy = {
  inLife:
    'Вы можете быть быстрым, но не ровным. Внимание «скачет»: то вы в потоке, то случается провал.',
  manifestations:
    'Не слышите последние секунды разговора. Пропускаете знакомый поворот за рулём. К вечеру переспрашиваете, хотя слышали. Ловите себя на том, что «выпадаете» на пару секунд, а потом возвращаетесь.',
  aboutResult:
    'Мозг работает рывками. Часто это связано с давлением, сахаром или сном. Проверьте эти три вещи.',
};

const FLEX: DomainInterpretationCopy = {
  inLife:
    'Вам трудно переключаться между делами. Если вас прервали — вы забываете, на чём остановились.',
  manifestations:
    'Отвлекли вопросом — забываете, что писали. Пытаетесь делать два дела сразу и не справляетесь ни с одним. Новый интерфейс в телефоне или программе вызывает лёгкое раздражение: вам нужно время, чтобы привыкнуть.',
  aboutResult:
    'Вы умеете глубоко погружаться, но плохо выныриваете. Это тренируется простым переключением каждые 20–30 минут.',
};

const RETENTION: DomainInterpretationCopy = {
  inLife:
    'Вы помните давнее, но свежее — то, что было минуты или часы назад — удерживаете хуже, чем раньше.',
  manifestations:
    'Забываете имя сразу после знакомства. Не помните, включили чайник или нет. Кладёте ключи «на видное место», а через час не можете вспомнить, куда именно. Говорите себе: «Вот сейчас помнил, а теперь — нет».',
  aboutResult:
    'Долговременная память в порядке. Кратковременная даёт сбои. Это функция, которая зависит от сна, стресса и гидратации — и восстанавливается.',
};

export const DOMAIN_INTERPRETATIONS: Record<CognitiveDomainKey, DomainInterpretationCopy> = {
  attentionStability: ATTENTION,
  reactionSpeed: SPEED,
  reactionStability: STABILITY,
  cognitiveFlexibility: FLEX,
  informationRetention: RETENTION,
};

export const getDomainInterpretation = (key: CognitiveDomainKey): DomainInterpretationCopy =>
  DOMAIN_INTERPRETATIONS[key];

/** Для PDF и строковых полей профиля. */
export const formatDomainInterpretationPlain = (copy: DomainInterpretationCopy): string =>
  [
    `В жизни: ${copy.inLife}`,
    `Как проявляется: ${copy.manifestations}`,
    `О чём говорит результат: ${copy.aboutResult}`,
  ].join('\n');
