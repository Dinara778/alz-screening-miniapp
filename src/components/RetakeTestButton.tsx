type Props = {
  onClick: () => void;
  className?: string;
};

/** Ссылка на новое прохождение (без сброса оплаченного отчёта за прошлую сессию). */
export const RetakeTestButton = ({ onClick, className = '' }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full py-2 text-center text-sm text-white/50 underline decoration-white/25 underline-offset-2 transition hover:text-white/75 ${className}`}
  >
    Пройти задания заново
    <span className="mt-0.5 block text-xs text-white/40 no-underline">
      Новый результат; расширенный отчёт — отдельная оплата
    </span>
  </button>
);
