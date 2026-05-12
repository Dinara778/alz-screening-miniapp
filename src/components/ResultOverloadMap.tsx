import type { OverloadMapItem, OverloadVisualTier } from '../utils/cognitiveAnalytics';

type StaticItem = {
  id: string;
  title: string;
  whatMeans: string;
  howNotice: string;
};

const OVERLOAD_MAP_STATIC: StaticItem[] = [
  {
    id: 'switch',
    title: 'Перегрузка переключением',
    whatMeans:
      'Мозг тратит лишние усилия, когда нужно переключаться между задачами или отвлекаться и возвращаться.',
    howNotice:
      'Вас прервали — и вы забыли, на чём остановились. Трудно делать два дела сразу (например, говорить и печатать).',
  },
  {
    id: 'unstable_attention',
    title: 'Нестабильность внимания',
    whatMeans:
      'Вы можете быть быстрым, но при этом нестабильным. Внимание «скачет»: то в потоке, то провал.',
    howNotice:
      'Чувствуете, что концентрация плавает. В разговоре или мыслях случаются небольшие паузы, когда вы будто «не здесь».',
  },
  {
    id: 'reactivity',
    title: 'Высокая реактивность',
    whatMeans: 'Мозг торопится ответить раньше, чем успел обработать информацию.',
    howNotice:
      'Иногда отвечаете или делаете что-то быстро, а потом понимаете, что ошиблись. Хочется нажать, не дожидаясь полной ясности.',
  },
  {
    id: 'exhaustion',
    title: 'Когнитивное истощение',
    whatMeans:
      'Умственная задача даётся тяжелее, чем раньше. К концу дня или долгого занятия сложнее сохранять точность.',
    howNotice:
      'К вечеру тяжело сосредоточиться. После 20 минут чтения или работы за экраном — уже хочется отвлечься.',
  },
  {
    id: 'load_resistance',
    title: 'Снижение устойчивости под нагрузкой',
    whatMeans: 'Сразу несколько процессов «проседают», когда нагрузка растёт.',
    howNotice:
      'Если нужно одновременно запомнить, понять и быстро ответить — качество падает сильнее. Чувствуете себя «выжатым» после непродолжительной умственной работы.',
  },
];

const activeRowClassByTier: Record<OverloadVisualTier, string> = {
  0: 'border-emerald-200 bg-emerald-50 text-slate-900',
  1: 'border-lime-300 bg-lime-50 text-slate-900',
  2: 'border-amber-300 bg-amber-50 text-slate-900',
  3: 'border-orange-400 bg-orange-50 text-slate-900',
};

const inactiveRowClass = 'border-slate-100 bg-slate-50/80 text-slate-800';

type Props = {
  overloadMap: OverloadMapItem[];
  overloadMapIntro: string;
  overloadVisualTier: OverloadVisualTier;
};

/** Персональная карта перегрузки: пять пунктов с фиксированными текстами; подсветка по active из аналитики. */
export const ResultOverloadMap = ({ overloadMap, overloadMapIntro, overloadVisualTier }: Props) => {
  const activeById = new Map(overloadMap.map((o) => [o.id, o.active]));
  const activeTone = activeRowClassByTier[overloadVisualTier];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Персональная карта перегрузки</h2>
      {overloadMapIntro ? (
        <p className="text-sm text-slate-600 leading-relaxed border-l-4 border-slate-300 pl-3 py-0.5">
          {overloadMapIntro}
        </p>
      ) : null}
      <div className="space-y-3">
        {OVERLOAD_MAP_STATIC.map((row) => {
          const active = activeById.get(row.id) ?? false;
          return (
            <div
              key={row.id}
              className={`rounded-lg border p-3 text-sm leading-relaxed ${
                active ? activeTone : inactiveRowClass
              }`}
            >
              <div className="font-semibold text-slate-900">{row.title}</div>
              <p className="mt-2 text-slate-700">
                <span className="font-medium text-slate-800">Что значит: </span>
                {row.whatMeans}
              </p>
              <p className="mt-2 text-slate-700">
                <span className="font-medium text-slate-800">Как вы это можете замечать: </span>
                {row.howNotice}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
