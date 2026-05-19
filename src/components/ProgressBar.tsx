type Props = { value: number; max: number };

export const ProgressBar = ({ value, max }: Props) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
      <div className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${pct}%` }} />
    </div>
  );
};
