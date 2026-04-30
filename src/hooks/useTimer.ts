import { useEffect, useMemo, useState } from 'react';

export const useTimer = (deadline: number | null) => {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!deadline) return;
    const i = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(i);
  }, [deadline]);

  const remainingMs = useMemo(() => {
    if (!deadline) return 0;
    return Math.max(0, deadline - now);
  }, [deadline, now]);

  return { remainingMs, remainingSec: Math.ceil(remainingMs / 1000), isFinished: remainingMs <= 0 };
};
