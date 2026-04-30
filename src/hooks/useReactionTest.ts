import { useState } from 'react';

export const useReactionTest = () => {
  const [successful, setSuccessful] = useState<number[]>([]);
  const [anticipations, setAnticipations] = useState(0);
  const [stimulusAt, setStimulusAt] = useState<number | null>(null);

  const registerStimulus = () => setStimulusAt(performance.now());

  const react = () => {
    if (stimulusAt === null) return { status: 'too-early' as const, rt: null };
    const rt = performance.now() - stimulusAt;
    if (rt < 100) {
      setAnticipations((v) => v + 1);
      setStimulusAt(null);
      return { status: 'anticipation' as const, rt };
    }
    setSuccessful((v) => [...v, rt]);
    setStimulusAt(null);
    return { status: 'success' as const, rt };
  };

  return { successful, anticipations, stimulusAt, registerStimulus, react, isDone: successful.length >= 30 };
};
