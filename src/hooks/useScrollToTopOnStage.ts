import { useEffect, useRef } from 'react';
import type { AppStage } from '../types';

/** Сбрасывает скролл при смене экрана — убирает «прыжки» от старой позиции. */
export function useScrollToTopOnStage(stage: AppStage) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }, [stage]);

  return scrollRef;
}
