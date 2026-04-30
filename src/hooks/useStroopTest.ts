import { useMemo, useState } from 'react';
import { TrialResult } from '../types';
import { createStroopTrials } from '../utils/generateStimuli';

export const useStroopTest = () => {
  const trials = useMemo(() => createStroopTrials(), []);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [start, setStart] = useState<number | null>(null);

  const current = trials[index];
  const startTrial = () => setStart(performance.now());

  const answer = (color: 'red' | 'blue' | 'green') => {
    if (!current || start === null) return;
    const rt = performance.now() - start;
    setResults((r) => [...r, { type: current.type, rt, correct: color === current.correct }]);
    setIndex((v) => v + 1);
    setStart(null);
  };

  return { current, index, total: trials.length, results, startTrial, answer, done: index >= trials.length };
};
