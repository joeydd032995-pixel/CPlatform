// Verbatim reference (nuts.gg). Returns a float result 0.00-100.00
// (e.g. roll of 73.42).
//
// Still needed (not in this reference): reject target <= 0 || target >= 100,
// and a multiplier-from-target formula incorporating house edge — see
// house-edge-payouts.ts.

import { RNGOptions, floatsGenerator } from "./provably-fair.ts";

export const calculateDiceRoll = (rngOptions: RNGOptions): number => {
  const float = floatsGenerator(rngOptions).next().value;
  return Math.floor(float * 10001) / 100;
};
