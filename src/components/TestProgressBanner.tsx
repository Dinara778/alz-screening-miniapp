import type { AppStage } from '../types';
import { getTestBlockProgress } from '../utils/testSessionProgress';
import { ProgressBar } from './ProgressBar';

type Props = { stage: AppStage };

export const TestProgressBanner = ({ stage }: Props) => {
  const meta = getTestBlockProgress(stage);
  if (!meta) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 space-y-2 shadow-sm">
      <div className="flex flex-wrap justify-between items-baseline gap-2 text-sm font-semibold text-emerald-950">
        <span>Задание {meta.block} из 5</span>
        <span className="font-medium text-emerald-800">{meta.label}</span>
      </div>
      <ProgressBar value={meta.block} max={5} />
    </div>
  );
};
