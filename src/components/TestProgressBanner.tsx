import type { AppStage } from '../types';
import { getTestBlockProgress } from '../utils/testSessionProgress';
import { ProgressBar } from './ProgressBar';

type Props = { stage: AppStage };

export const TestProgressBanner = ({ stage }: Props) => {
  const meta = getTestBlockProgress(stage);
  if (!meta) return null;
  return (
    <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-100/95 px-4 py-3 shadow-sm dark:border-emerald-600 dark:bg-emerald-900/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
        <span>Задание {meta.block} из 5</span>
        <span className="font-semibold text-emerald-900 dark:text-emerald-200">{meta.label}</span>
      </div>
      <ProgressBar value={meta.block} max={5} />
    </div>
  );
};
