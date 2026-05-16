import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TrialResult } from '../types';
import { createStroopTrials } from '../utils/generateStimuli';

export type StroopAnswerColor = 'red' | 'blue' | 'green';

/**
 * Струп: ответ — цвет чернил (заливки букв), не смысл слова.
 * useLayoutEffect + ref: на Android/iOS таймер стартует до отрисовки, тапы не теряются из‑за start === null.
 */
export const useStroopTest = (sessionSeed: number) => {
  const trials = useMemo(() => createStroopTrials(sessionSeed), [sessionSeed]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TrialResult[]>([]);
  const trialStartRef = useRef(performance.now());
  const answeringRef = useRef(false);

  const current = trials[index];
  const done = index >= trials.length;

  useLayoutEffect(() => {
    if (done) return;
    answeringRef.current = false;
    trialStartRef.current = performance.now();
  }, [index, done, sessionSeed]);

  const answer = useCallback(
    (color: StroopAnswerColor) => {
      if (!current || done || answeringRef.current) return;
      answeringRef.current = true;
      const rt = Math.max(1, performance.now() - trialStartRef.current);
      setResults((r) => [
        ...r,
        {
          type: current.type,
          rt,
          correct: color === current.correct,
        },
      ]);
      setIndex((v) => v + 1);
    },
    [current, done],
  );

  /** @deprecated оставлено для совместимости; таймер стартует в useLayoutEffect */
  const startTrial = () => {
    trialStartRef.current = performance.now();
  };

  return {
    current,
    index,
    total: trials.length,
    results,
    startTrial,
    answer,
    done,
  };
};
