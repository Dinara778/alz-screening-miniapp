import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export const Button = ({ variant = 'primary', className = '', ...props }: Props) => {
  const palette = {
    primary: 'bg-emerald-900 text-white hover:bg-emerald-800',
    secondary: 'bg-white border-2 border-emerald-900 text-emerald-950 hover:bg-emerald-50',
    danger: 'bg-red-800 text-white hover:bg-red-700',
  }[variant];

  return (
    <button
      type={props.type ?? 'button'}
      className={`rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${palette} ${className}`}
      {...props}
    />
  );
};
