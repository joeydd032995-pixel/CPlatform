// Verbatim reference (nuts.gg). Same draw mechanic as Blackjack — up to 52
// cards, each independently drawn WITH replacement from the 52-card deck.
//
// NOTE: import paths match the original source; swap to the reconciled core
// (core-rng-specialist/references/provably-fair-core.ts) when wiring in.

import { floatsGenerator, RNGOptions } from "./provably-fair.ts";
import { Card, deck, cardIdToCard, getCardRankValue } from "./deck.ts";
import { applyHouseEdge } from "../house-edge-payouts";

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

// Payout side (from FinalReviewDoc.txt) — reconciled with the
// draw-with-replacement generator above: since each draw is independent
// from the full 52-card deck (the previous card can reappear), the
// denominator is a constant 52, not a shrinking "remaining cards" count,
// and the "equal" guess has 4 favorable outcomes (all 4 suits of the same
// rank, including the exact card just drawn).
export const HOUSE_EDGE = 0.01;

export type HiLoGuess = "higher" | "lower" | "equal";

export const resolveHiLo = (
  currentCard: Card,
  guess: HiLoGuess,
  remainingCards: number = 52
): number => {
  const rank = getCardRankValue(currentCard);
  let favorable = 0;

  if (guess === "higher") favorable = (13 - rank) * 4;
  else if (guess === "lower") favorable = (rank - 1) * 4;
  else if (guess === "equal") favorable = 4; // Same rank, with replacement

  const prob = favorable / remainingCards;
  return prob > 0 ? applyHouseEdge(1 / prob, HOUSE_EDGE) : 0;
};
