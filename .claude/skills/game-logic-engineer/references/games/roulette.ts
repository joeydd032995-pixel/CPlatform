// Verbatim reference (nuts.gg). European-style: 0-36 (37 values). This
// particular array/comment claims "Numbers 37 maps to the extra slot" but
// the array only goes to 36 with a stray trailing `37` — treat the color
// mapping below as PLAUSIBLE BUT UNVERIFIED against a real European wheel
// layout; testing-devops-specialist should confirm it against the actual
// felt/wheel red-black assignment before shipping.

import { floatsGenerator, RNGOptions } from "./provably-fair.ts";

export enum RouletteColor {
  Green = "green",
  Red   = "red",
  Black = "black",
}

export const rouletteNumbersArray = [
  0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37,
] as const;

export type RouletteResult = (typeof rouletteNumbersArray)[number];

export const calculateRouletteResult = ({
  serverSeed,
  clientSeed,
  nonce,
}: RNGOptions): RouletteResult => {
  const float = floatsGenerator({ serverSeed, clientSeed, nonce }).next().value;
  return Math.floor(float * 37) as RouletteResult;
};

export const rouletteResultToColor = (
  rouletteResult: RouletteResult
): RouletteColor => {
  if (rouletteResult === 0) {
    return RouletteColor.Green;
  } else if (
    (rouletteResult >= 1  && rouletteResult <= 10) ||
    (rouletteResult >= 19 && rouletteResult <= 28)
  ) {
    return rouletteResult % 2 === 0 ? RouletteColor.Black : RouletteColor.Red;
  } else if (
    (rouletteResult >= 11 && rouletteResult <= 18) ||
    (rouletteResult >= 29 && rouletteResult <= 36)
  ) {
    return rouletteResult % 2 === 0 ? RouletteColor.Red : RouletteColor.Black;
  }
  return RouletteColor.Black;
};

// Still needed (not in this reference): bet-type payout table (straight,
// split, street, column, dozen, red/black, odd/even, high/low) — see
// house-edge-payouts.ts.
