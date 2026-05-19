type Props = { value: number; max: number };

export const ProgressBar = ({ value, max }: Props) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-3 w-full rounded-full border border-white/10 bg-white/10">
      <div className="h-3 rounded-full bg-teal-400/90" style={{ width: `${pct}%` }} />
    </div>
  );
};
