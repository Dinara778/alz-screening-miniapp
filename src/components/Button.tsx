import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'sell';
};

export const Button = ({ variant = 'primary', className = '', ...props }: Props) => {
  const palette = {
    primary:
      'bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-md shadow-emerald-900/25 hover:from-emerald-700 hover:to-teal-800 dark:from-emerald-600 dark:to-teal-700 dark:hover:from-emerald-500 dark:hover:to-teal-600',
    secondary:
      'border border-white/20 bg-white/5 text-white/90 hover:border-white/35 hover:bg-white/10',
    danger: 'bg-gradient-to-br from-red-700 to-red-900 text-white shadow-md shadow-red-900/20 hover:from-red-600 hover:to-red-800',
    /** CTA оплаты: тот же насыщенный красный, что в ранних версиях (399 ₽ и разбор). */
    sell:
      'bg-red-600 text-white shadow-lg shadow-red-600/35 hover:bg-red-500 active:bg-red-700 border border-red-700/30',
  }[variant];

  return (
    <button
      type={props.type ?? 'button'}
      className={`rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${palette} ${className}`}
      {...props}
    />
  );
};
