import { useMemo, useState } from 'react';
import { TrialResult } from '../types';
import { createFlankerTrials } from '../utils/generateStimuli';

export const useFlankerTest = (sessionSeed: number) => {
  const trials = useMemo(() => createFlankerTrials(sessionSeed), [sessionSeed]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [trialStart, setTrialStart] = useState<number | null>(null);

  const current = trials[index];
  const startTrial = () => setTrialStart(performance.now());

  const answer = (dir: '<' | '>') => {
    if (!current || trialStart === null) return;
    const rt = performance.now() - trialStart;
    setResults((r) => [...r, { type: current.type, rt: rt <= 2000 ? rt : null, correct: dir === current.correct && rt <= 2000, timedOut: rt > 2000 }]);
    setIndex((v) => v + 1);
    setTrialStart(null);
  };

  const timeout = () => {
    if (!current) return;
    setResults((r) => [...r, { type: current.type, rt: null, correct: false, timedOut: true }]);
    setIndex((v) => v + 1);
    setTrialStart(null);
  };

  return { current, index, total: trials.length, results, startTrial, answer, timeout, done: index >= trials.length };
};
