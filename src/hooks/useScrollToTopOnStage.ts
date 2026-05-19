import { useEffect, useRef } from 'react';
import type { AppStage } from '../types';

/** Сбрасывает скролл при смене экрана — убирает «прыжки» от старой позиции. */
export function useScrollToTopOnStage(stage: AppStage) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [stage]);

  return scrollRef;
}
