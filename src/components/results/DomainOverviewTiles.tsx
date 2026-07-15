import type { DomainScore } from '../../utils/cognitiveAnalytics';
import { getDomainStatusChip, type DomainChipId } from '../../utils/domainStatusChip';
import { scoreAccentFromValue } from './scoreAccent';

type TileSpec = {
  chipId: DomainChipId;
  domainKey: DomainScore['key'];
  label: string;
  icon: string;
  iconClass: string;
};

const TILES: TileSpec[] = [
  {
    chipId: 'attention',
    domainKey: 'attentionStability',
    label: 'Внимание',
    icon: '🧠',
    iconClass: 'bg-sky-500/20 text-sky-300',
  },
  {
    chipId: 'speed',
    domainKey: 'reactionSpeed',
    label: 'Скорость',
    icon: '⚡',
    iconClass: 'bg-orange-500/20 text-orange-300',
  },
  {
    chipId: 'memory',
    domainKey: 'informationRetention',
    label: 'Память',
    icon: '📘',
    iconClass: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    chipId: 'variability',
    domainKey: 'reactionStability',
    label: 'Вариативность',
    icon: '〰',
    iconClass: 'bg-violet-500/20 text-violet-300',
  },
];

type Props = {
  domains: DomainScore[];
  indexValue: number;
  ready?: boolean;
};

export const DomainOverviewTiles = ({ domains, indexValue, ready = true }: Props) => {
  const scoreOf = (key: DomainScore['key']) =>
    domains.find((d) => d.key === key)?.score ?? 50;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-sm"
              aria-hidden
            >
              ◎
            </span>
            <h2 className="text-base font-bold leading-tight text-white sm:text-lg">
              Когнитивный ресурс
            </h2>
          </div>
          <p className="mt-1.5 pl-9 text-[0.8125rem] leading-snug text-white/65 sm:text-sm">
            Индекс на сегодня по доменам:
          </p>
        </div>
        <div
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums text-emerald-950"
          style={{ backgroundColor: scoreAccentFromValue(indexValue) }}
        >
          {ready ? `${indexValue} / 100` : '— / 100'}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {TILES.map((tile) => {
          const score = scoreOf(tile.domainKey);
          const status = getDomainStatusChip(tile.chipId, score);
          const accent = scoreAccentFromValue(score);
          return (
            <div
              key={tile.chipId}
              className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-3 text-center"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[0.7rem] ${tile.iconClass}`}
                  aria-hidden
                >
                  {tile.icon}
                </span>
                <span className="text-[0.75rem] font-semibold text-white/85 sm:text-[0.8125rem]">
                  {tile.label}
                </span>
              </div>
              {ready ? (
                <p
                  className="mt-1.5 text-[1.75rem] font-bold leading-none tabular-nums sm:text-[1.9rem]"
                  style={{ color: accent }}
                >
                  {score}
                </p>
              ) : (
                <p className="mt-1.5 text-[1.75rem] font-semibold leading-none text-white/30">—</p>
              )}
              <p className="mt-1.5 text-[0.6875rem] leading-tight text-white/55 sm:text-xs">
                {ready ? status : 'нет данных'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
