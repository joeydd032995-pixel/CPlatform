// Verbatim reference (nuts.gg). Generates a "death point" (1-20) — the lane
// where the chicken dies. If death point > number of lanes for the
// difficulty, the chicken survives to the end. Higher difficulty = more
// floats used to find the minimum, making early death more likely.

import { floatsGenerator, RNGOptions } from "./provably-fair.ts";

export enum ChickenDifficultySlice {
  EASY   = 1,
  MEDIUM = 3,
  HARD   = 5,
  EXPERT = 10,
}

export type ChickenRNGOptions = RNGOptions & {
  difficltySlice: ChickenDifficultySlice;
};

export const chickenRandomShuffle = (floatsArr: number[]): number[] => {
  const deathPointArr = Array.from({ length: 20 }, (_, i) => i + 1);

  for (let i = deathPointArr.length - 1; i > 0; i--) {
    const j = Math.floor(floatsArr[i] * (i + 1));
    [deathPointArr[i], deathPointArr[j]] = [deathPointArr[j], deathPointArr[i]];
  }

  return deathPointArr;
};

export const calculateChickenDeathPoint = (options: ChickenRNGOptions): number => {
  const floats = floatsGenerator({ ...options });
  const floatsArr = Array.from({ length: 20 }, () => floats.next().value);

  const shuffledArr = chickenRandomShuffle(floatsArr);
  const slicedShuffledArr = shuffledArr.slice(0, options.difficltySlice);

  return Math.min(...slicedShuffledArr);
};
