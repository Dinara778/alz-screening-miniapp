import { useEffect, useRef } from 'react';
import type { AppStage } from '../types';

/** Сбрасывает скролл при смене экрана — убирает «прыжки» от старой позиции. */
export function useScrollToTopOnStage(stage: AppStage) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reset = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    reset();
    const id = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(id);
  }, [stage]);

  return scrollRef;
}
