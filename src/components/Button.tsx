import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'sell';
};

export const Button = ({ variant = 'primary', className = '', ...props }: Props) => {
  const palette = {
    primary:
      'bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-md shadow-emerald-900/25 hover:from-emerald-700 hover:to-teal-800 dark:from-emerald-600 dark:to-teal-700 dark:hover:from-emerald-500 dark:hover:to-teal-600',
    secondary:
      'bg-white/90 border-2 border-emerald-800 text-emerald-950 hover:bg-emerald-50 dark:bg-slate-800/90 dark:border-emerald-500/60 dark:text-emerald-100 dark:hover:bg-slate-700',
    danger: 'bg-gradient-to-br from-red-700 to-red-900 text-white shadow-md shadow-red-900/20 hover:from-red-600 hover:to-red-800',
    /** CTA оплаты: бордовый, без градиента primary */
    sell:
      'border border-white/15 bg-[#722F37] text-white shadow-lg shadow-black/30 hover:bg-[#632a31] active:bg-[#56252b]',
  }[variant];

  return (
    <button
      type={props.type ?? 'button'}
      className={`rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${palette} ${className}`}
      {...props}
    />
  );
};
