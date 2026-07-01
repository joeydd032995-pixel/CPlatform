// Verbatim reference (nuts.gg). Generates up to 29 cards per game round.
// Each card is drawn by mapping a float -> index into the 52-card deck
// (WITH replacement — no shuffle, independent draws). This is the
// authoritative algorithm; do not replace with a Fisher-Yates
// shuffle-without-replacement approach.
//
// NOTE: import paths below (`./provably-fair.ts`, `RNGOptions`) match the
// original source. When wiring into the real repo, swap to the reconciled
// core's `createFloatGenerator`/`GeneratorOptions`
// (see core-rng-specialist/references/provably-fair-core.ts) — same
// generator semantics, renamed exports.

import { floatsGenerator, RNGOptions } from "./provably-fair.ts";
import { deck, cardIdToCard } from "./deck.ts";

const BLACKJACK_GAME_MAX_ROUNDS_SOFT_LIMIT = 29;

type CalculateBlackjackResultsOptions = RNGOptions & {
  limit?: number;
};

export const calculateBlackjackResults = ({
  limit = BLACKJACK_GAME_MAX_ROUNDS_SOFT_LIMIT,
  ...rngOptions
}: CalculateBlackjackResultsOptions): Card[] => {
  const floatsRng = floatsGenerator(rngOptions);

  return Array(limit)
    .fill(0)
    .map(() => {
      const float = floatsRng.next().value;
      const cardId = Math.floor(float * deck.length);
      return cardIdToCard(cardId);
    });
};
