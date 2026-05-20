import type { CognitiveDomainKey } from '../types';
import type { CognitiveAnalytics } from './cognitiveAnalytics';

const DOMAIN_FLAG_THRESHOLD = 50;

export type InterpretationFlags = {
  attentionInstability: boolean;
  switchingOverload: boolean;
  retentionDrop: boolean;
  highReactivity: boolean;
  domainFlags: Record<CognitiveDomainKey, boolean>;
  weakestDomain: CognitiveDomainKey | null;
};

export type InterpretationMetrics = CognitiveAnalytics['metrics'];

export type DetailedInterpretation = {
  inLife: string;
  feeling: string;
  recommendation: string;
};

export function buildInterpretationFlags(
  domains: { key: CognitiveDomainKey; score: number }[],
  patterns: { id: string; active: boolean }[],
): InterpretationFlags {
  const domainFlags = Object.fromEntries(
    domains.map((d) => [d.key, d.score < DOMAIN_FLAG_THRESHOLD]),
  ) as Record<CognitiveDomainKey, boolean>;

  const weakest = domains.reduce<{ key: CognitiveDomainKey; score: number } | null>(
    (best, d) => (!best || d.score < best.score ? d : best),
    null,
  );

  const byId = Object.fromEntries(patterns.map((p) => [p.id, p.active]));

  return {
    attentionInstability: Boolean(byId.attention_instability),
    switchingOverload: Boolean(byId.switching_overload),
    retentionDrop: Boolean(byId.retention_drop),
    highReactivity: Boolean(byId.high_reactivity),
    domainFlags,
    weakestDomain: weakest?.key ?? null,
  };
}

type DomainCopy = { inLife: string; feeling: string; recommendation: string };

const DOMAIN_MID_BAND: Record<CognitiveDomainKey, DomainCopy> = {
  attentionStability: {
    inLife:
      'Вы замечаете, что фоновый шум, уведомления или чужая речь легко сбивают мысль — приходится заново «входить» в задачу.',
    feeling:
      'Внутри ощущение, что внимание то собирается, то рассыпается — без паники, скорее как усталость от лишних переключений.',
    recommendation:
      'На пару дней оставьте один главный поток задач и уберите лишние уведомления в часы, когда нужен фокус.',
  },
  reactionSpeed: {
    inLife:
      'Перед ответом или действием нужна лишняя секунда — в разговоре или за экраном это ощущается как лёгкая заминка.',
    feeling:
      'Не «торможение», а будто мозг чуть дольше «включается» — особенно когда задача непривычная.',
    recommendation:
      'Не торопите себя: короткая пауза перед ответом часто возвращает точность без гонки.',
  },
  reactionStability: {
    inLife:
      'Темп бывает рваным: то вы в потоке, то внезапно «выпадаете» на несколько секунд, хотя в целом справляетесь.',
    feeling:
      'Ощущение скачков ритма — не постоянная усталость, а неровность, которую вы начинаете замечать сами.',
    recommendation:
      'Дробите работу на короткие блоки 20–30 минут с 3–5 минутами смены позы и взгляда.',
  },
  cognitiveFlexibility: {
    inLife:
      'Переключение между делами даётся тяжелее: после прерывания сложнее вспомнить, на чём остановились.',
    feeling:
      'Лёгкое раздражение от смены контекста — хочется довести одно до конца, прежде чем открывать другое.',
    recommendation:
      'Сократите параллельные вкладки и чаты: завершайте микро-шаг, прежде чем переключаться.',
  },
  informationRetention: {
    inLife:
      'Свежее забывается быстрее: зашли в комнату — и цель вылетела, имя собеседника нужно «добирать» из памяти.',
    feeling:
      'Ощущение, что контекст не держится так крепко, как хотелось бы — без страха, скорее как сигнал перегрузки.',
    recommendation:
      'Записывайте короткие якоря (одна строка) после важных разговоров и перед переключением задачи.',
  },
};

const HIGH_BAND_DEFAULT: DomainCopy = {
  inLife:
    'В обычном ритме дня вы держите фокус уверенно: отвлечения случаются, но не ломают общий темп.',
  feeling: 'Внутри — относительная собранность и предсказуемость, без ощущения «гонки» с собой.',
  recommendation:
    'Сохраняйте чередование работы и короткого отдыха — резких изменений режима не требуется.',
};

const MID_GENERIC: DomainCopy = {
  inLife:
    'В целом вы справляетесь, но при длинных блоках или множестве источников информации качество чуть проседает.',
  feeling:
    'Ощущение, что ресурс есть, но его нужно беречь — особенно к вечеру или после серии переключений.',
  recommendation:
    'Планируйте паузы до спада концентрации, а не после — так проще удерживать ровный темп.',
};

const LOW_GENERIC: DomainCopy = {
  inLife:
    'Даже умеренная нагрузка быстрее забирает внимание: задачи дробятся, возврат к фокусу требует больше усилий.',
  feeling:
    'Внутри — усталость от информационного шума, без катастрофизации: тело просит упростить входящий поток.',
  recommendation:
    'На ближайшие дни сократите параллельные каналы (чаты, вкладки, фоновые звуки) до одного главного.',
};

function pickDomainMidBand(flags: InterpretationFlags): DomainCopy {
  const order: CognitiveDomainKey[] = [
    'informationRetention',
    'attentionStability',
    'cognitiveFlexibility',
    'reactionStability',
    'reactionSpeed',
  ];
  for (const key of order) {
    if (flags.domainFlags[key]) return DOMAIN_MID_BAND[key];
  }
  if (flags.weakestDomain) return DOMAIN_MID_BAND[flags.weakestDomain];
  return MID_GENERIC;
}

function bandFromIndex(index: number): 'high' | 'mid' | 'low' | 'critical' {
  if (index >= 70) return 'high';
  if (index >= 50) return 'mid';
  if (index >= 25) return 'low';
  return 'critical';
}

/**
 * Профильная расшифровка под индексом: быт, ощущения, мягкие рекомендации.
 * Для 50–69 учитывает домен с «красным» флагом (score &lt; 50).
 */
export function getDetailedInterpretation(
  index: number,
  flagsObject: InterpretationFlags,
  _metricsObject: InterpretationMetrics,
): DetailedInterpretation {
  const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(index) ? index : 50)));
  const band = bandFromIndex(v);

  if (band === 'high') {
    return { ...HIGH_BAND_DEFAULT };
  }

  if (band === 'mid') {
    if (v >= 60) {
      return pickDomainMidBand(flagsObject);
    }
    const base = pickDomainMidBand(flagsObject);
    if (flagsObject.switchingOverload || flagsObject.highReactivity) {
      return {
        inLife:
          'Переключения и поток стимулов заметно «съедают» ресурс: сложнее удержать одну линию мысли до конца.',
        feeling:
          'Ощущение перегруженности без тревоги — как будто мозг просит меньше одновременных входов.',
        recommendation:
          'Сократите уведомления и оставьте один приоритет на интервал 25–40 минут, затем короткая пауза.',
      };
    }
    return base;
  }

  if (band === 'low') {
    if (flagsObject.retentionDrop) {
      return {
        inLife:
          'Свежее удерживается хуже: детали разговора или только что прочитанное быстрее распадаются.',
        feeling:
          'Лёгкое ощущение «рассыпчатости» мысли — не страх, а сигнал дать голове меньше одновременных задач.',
        recommendation:
          'Меньше многозадачности: один экран, одна задача; короткие записи-якоря после важных эпизодов.',
      };
    }
    if (flagsObject.attentionInstability) {
      return {
        inLife:
          'Концентрация плавает: вы можете начать с энергией, но к середине блока заметно устаёте удерживать фокус.',
        feeling:
          'Внутренний ритм неровный — хочется остановиться и «перезагрузиться» чаще, чем обычно.',
        recommendation:
          'Режим коротких спринтов с обязательным 5-минутным выходом из экрана между ними.',
      };
    }
    return { ...LOW_GENERIC };
  }

  return {
    inLife:
      'Даже простые дела требуют больше усилий удержать внимание: ошибки и срывы фокуса заметнее обычного.',
    feeling:
      'Сильная усталость от потока информации — важно воспринимать это как сигнал упростить день, а не «слабость».',
    recommendation:
      'Максимально упростите день: минимум параллельных задач, тишина, короткие эпизоды работы и длинные паузы.',
  };
}
