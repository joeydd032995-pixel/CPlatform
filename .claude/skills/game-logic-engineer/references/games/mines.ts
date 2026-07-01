// Verbatim reference (nuts.gg). Draws `mines` unique positions from a
// 25-tile grid (0-24) using partial Fisher-Yates via splice — same pattern
// as Keno but 0-indexed on a 5x5 grid. Results sorted ascending.

import { RNGOptions, floatsGenerator } from "./provably-fair.ts";

export const MINES_GAME_TILES_COUNT = 25;

export type MinesRNGOptions = RNGOptions & { mines: number };

export const calculateMinesPositions = ({
  mines,
  ...rngOptions
}: MinesRNGOptions): number[] => {
  const floatsRng = floatsGenerator({ ...rngOptions });

  const remainingPositions = Array(MINES_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => index); // [0, 1, 2, ... 24]

  return Array(mines)
    .fill(0)
    .map((_, index) => {
      const float = floatsRng.next().value;

      const relativeMinePosition = Math.floor(
        float * (MINES_GAME_TILES_COUNT - index)
      );
      const [absoluteMinePosition] = remainingPositions.splice(
        relativeMinePosition,
        1
      );

      return absoluteMinePosition;
    })
    .sort((left, right) => left - right);
};

// Still needed (not in this reference): a combinatorial payout formula for
// "N safe tiles revealed out of 25 - mines" — see house-edge-payouts.ts.
// This is the game gameService.ts currently wires up (with a placeholder
// multiplier of 2), so it's the highest-priority payout formula to finish.
