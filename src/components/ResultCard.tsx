type Props = { title: string; value: string; flag?: boolean };

export const ResultCard = ({ title, value, flag }: Props) => (
  <div className={`rounded-xl p-4 border-2 ${flag ? 'border-red-400 bg-red-50' : 'border-emerald-300 bg-white'}`}>
    <div className="text-sm text-emerald-900">{title}</div>
    <div className="text-lg font-semibold text-slate-950">{value}</div>
  </div>
);
