import { useState } from 'react';
import { normalizeWords } from '../utils/scoring';

export const useWordMemoryTest = () => {
  const [immediate, setImmediate] = useState<string[]>([]);
  const [delayed, setDelayed] = useState<string[]>([]);

  return {
    immediate,
    delayed,
    saveImmediate: (text: string) => setImmediate(normalizeWords(text)),
    saveDelayed: (text: string) => setDelayed(normalizeWords(text)),
  };
};
