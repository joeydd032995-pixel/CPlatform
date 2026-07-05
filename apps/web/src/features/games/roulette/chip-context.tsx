'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CHIP_PRESETS } from '@/lib/roulette-felt';

type RouletteChipContextValue = {
  selectedChip: number;
  setSelectedChip: (chip: number) => void;
  customChipText: string;
  setCustomChipText: (text: string) => void;
};

const RouletteChipContext = createContext<RouletteChipContextValue | null>(null);

export function RouletteChipProvider({ children }: { children: ReactNode }) {
  const [selectedChip, setSelectedChip] = useState<number>(5);
  const [customChipText, setCustomChipText] = useState('');

  const value = useMemo(
    () => ({ selectedChip, setSelectedChip, customChipText, setCustomChipText }),
    [selectedChip, customChipText]
  );

  return <RouletteChipContext.Provider value={value}>{children}</RouletteChipContext.Provider>;
}

export function useRouletteChip(): RouletteChipContextValue {
  const ctx = useContext(RouletteChipContext);
  if (!ctx) {
    throw new Error('useRouletteChip must be used within RouletteChipProvider');
  }
  return ctx;
}

export { CHIP_PRESETS };