// Verbatim reference (nuts.gg). Same draw mechanic as Blackjack — up to 52
// cards, each independently drawn WITH replacement from the 52-card deck.
//
// NOTE: import paths match the original source; swap to the reconciled core
// (core-rng-specialist/references/provably-fair-core.ts) when wiring in.

import { floatsGenerator, RNGOptions } from "./provably-fair.ts";
import { Card, deck, cardIdToCard, getCardRankValue } from "./deck.ts";

export const HILO_GAME_MAX_ROUNDS_SOFT_LIMIT = 52;

export type CalculateHiloResultsOptions = RNGOptions & {
  limit?: number;
};

export const calculateHiloResults = ({
  limit = HILO_GAME_MAX_ROUNDS_SOFT_LIMIT,
  ...rngOptions
}: CalculateHiloResultsOptions): readonly Card[] => {
  const floatsRng = floatsGenerator(rngOptions);

  return Array(limit)
    .fill(0)
    .map(() => {
      const float = floatsRng.next().value;
      const cardId = Math.floor(float * deck.length);
      return cardIdToCard(cardId);
    });
};

// Payout side (from FinalReviewDoc.txt) — remaining-card-based odds.
// NOT yet reconciled with the draw-with-replacement generator above; the
// `remainingCards` parameter here assumes a shrinking deck model. This needs
// resolving in the full implementation (either compute remaining cards
// against a running "seen cards" set, or redefine remainingCards as a
// constant 51 assumption for a with-replacement game). Flagged for
// game-logic-engineer to resolve when implementing HiLo payouts.
export const HOUSE_EDGE = 0.01;

export type HiLoGuess = "higher" | "lower" | "equal";

export const resolveHiLo = (
  currentCard: Card,
  guess: HiLoGuess,
  remainingCards: number = 51
): number => {
  const rank = getCardRankValue(currentCard);
  let favorable = 0;

  if (guess === "higher") favorable = (13 - rank) * 4;
  else if (guess === "lower") favorable = (rank - 1) * 4;
  else if (guess === "equal") favorable = 3; // Same rank

  const prob = favorable / remainingCards;
  return prob > 0 ? (1 / prob) * (1 - HOUSE_EDGE) : 0;
};
