// Verbatim reference (nuts.gg). Draws 10 unique winning positions from
// 1-40, sorted ascending. Uses partial Fisher-Yates: splices from a
// shrinking remaining-positions array.

import { RNGOptions, floatsGenerator } from "./provably-fair.ts";

export const KENO_GAME_TILES_COUNT     = 40;
export const KENO_GAME_TILES_HIT_COUNT = 10;

export enum KenoRisk {
  CLASSIC = "Classic",
  LOW     = "Low",
  MEDIUM  = "Medium",
  HIGH    = "High",
}

export const calculateKenoHitPositions = ({ ...rngOptions }: RNGOptions): number[] => {
  const floatsRng = floatsGenerator({ ...rngOptions });

  const remainingPositions = Array(KENO_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => index + 1);

  return Array(KENO_GAME_TILES_HIT_COUNT)
    .fill(0)
    .map((_, index) => {
      const float = floatsRng.next().value;
      const relativeMinePosition = Math.floor(
        float * (KENO_GAME_TILES_COUNT - index)
      );
      const [absoluteMinePosition] = remainingPositions.splice(
        relativeMinePosition,
        1
      );
      return absoluteMinePosition;
    })
    .sort((left, right) => left - right);
};

// Still needed (not in this reference): a hit-count -> multiplier paytable
// per KenoRisk level — see house-edge-payouts.ts.
