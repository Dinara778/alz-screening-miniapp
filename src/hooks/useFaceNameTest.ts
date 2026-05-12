import { useMemo, useState } from 'react';
import { createFaceTrials } from '../utils/generateStimuli';

export const useFaceNameTest = (sessionSeed: number) => {
  const trials = useMemo(() => createFaceTrials(sessionSeed), [sessionSeed]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const setAnswer = (faceId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [faceId]: value }));
  };

  return { trials, answers, setAnswer, isComplete: trials.every((t) => Boolean(answers[t.id])) };
};
