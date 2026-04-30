type Props = { value: number; max: number };

export const ProgressBar = ({ value, max }: Props) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full rounded-full bg-emerald-100 h-3 border border-emerald-300">
      <div className="h-3 rounded-full bg-emerald-900" style={{ width: `${pct}%` }} />
    </div>
  );
};
