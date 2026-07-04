// Generator (calculateBlackjackResults) ported from
// .claude/skills/game-logic-engineer/references/games/blackjack.ts
// verbatim — up to 29 cards drawn INDEPENDENTLY WITH REPLACEMENT from the
// full 52-card deck (Math.floor(float * 52) per card, no shrinking deck /
// shuffle). Exported here (unmodified) purely for verification parity —
// resolveBlackjack below draws its own cards ON DEMAND from the same
// float stream / float->cardId mapping rather than pre-materializing
// exactly 29 cards, since ace-heavy hands (many single-pip hits) can in
// rare cases exceed 29 draws. Any prefix of the stream drawn by
// resolveBlackjack is, by construction, identical to the corresponding
// prefix of calculateBlackjackResults({ ...seed, limit: N }) for the same
// seed/nonce.
//
// Table rules (infinite deck, consistent with draw-with-replacement):
// no split / double / surrender / insurance. Deal order: player, dealer,
// player, dealer, then player hits (per the fixed strategy table below),
// then dealer hits. Ace = 1 or 11 (whichever doesn't bust, "soft" totals).
// Face cards = 10. Naturals (21 on the initial two cards) are only
// recognized on the initial two-card hand, not a 21 reached via hitting.
// Dealer hits to 16 and stands on all 17s (including soft 17).

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { drawCardFromFloat, getCardRankValue, type Card } from './deck.js';
import { applyHouseEdge } from './house-edge.js';
import { validateBetAmount } from './bet-amount.js';

const BLACKJACK_GAME_MAX_ROUNDS_SOFT_LIMIT = 29;

export type CalculateBlackjackResultsOptions = GeneratorOptions & {
  limit?: number;
};

export const calculateBlackjackResults = ({
  limit = BLACKJACK_GAME_MAX_ROUNDS_SOFT_LIMIT,
  ...rngOptions
}: CalculateBlackjackResultsOptions): Card[] => {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Invalid blackjack limit: ${limit}`);
  }

  const floatsRng = createFloatGenerator(rngOptions);

  return Array(limit)
    .fill(0)
    .map(() => drawCardFromFloat(floatsRng.next().value));
};

// --- Hand evaluation ------------------------------------------------------

export type HandValue = {
  total: number;
  soft: boolean;
};

// Best non-busting total, treating each Ace as 1 or 11.
export function handValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    const rank = getCardRankValue(card);
    if (rank === 1) {
      aceCount++;
      total += 1;
    } else {
      total += Math.min(rank, 10);
    }
  }

  if (aceCount > 0 && total + 10 <= 21) {
    return { total: total + 10, soft: true };
  }
  return { total, soft: false };
}

export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

// Bucket value used only for dealer-upcard-aware strategy lookups: Ace is
// treated as 11 (its own bucket), everything else is min(rank, 10).
function upcardValue(card: Card): number {
  const rank = getCardRankValue(card);
  return rank === 1 ? 11 : Math.min(rank, 10);
}

// Fixed player basic-strategy table (dealer-upcard aware, no
// split/double/surrender since none of those actions exist here).
export function shouldPlayerHit(
  playerCards: readonly Card[],
  dealerUpcard: Card
): boolean {
  const { total, soft } = handValue(playerCards);
  const upcard = upcardValue(dealerUpcard);

  if (soft) {
    if (total <= 17) return true;
    if (total === 18) return upcard === 9 || upcard === 10 || upcard === 11;
    return false; // soft 19+
  }

  if (total <= 11) return true;
  if (total === 12) return !(upcard >= 4 && upcard <= 6);
  if (total >= 13 && total <= 16) return !(upcard >= 2 && upcard <= 6);
  return false; // hard 17+
}

// Dealer hits to 16, stands on all 17s (soft or hard).
export function shouldDealerHit(dealerCards: readonly Card[]): boolean {
  return handValue(dealerCards).total <= 16;
}

// --- Params / resolve ------------------------------------------------------

export const BlackjackParamsSchema = z.object({}).strict();

export type BlackjackParams = z.infer<typeof BlackjackParamsSchema>;

export type BlackjackResult = 'blackjack' | 'win' | 'push' | 'lose';

export type BlackjackOutcome = {
  playerCards: Card[];
  dealerCards: Card[];
  playerTotal: number;
  dealerTotal: number;
  result: BlackjackResult;
};

export function resolveBlackjack(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: BlackjackOutcome; multiplier: number; payout: number } {
  validateBlackjackParams(params);
  validateBetAmount('blackjack', betAmount);

  const floatsRng = createFloatGenerator(generatorOpts);
  const drawCard = (): Card => drawCardFromFloat(floatsRng.next().value);

  const playerCards: Card[] = [];
  const dealerCards: Card[] = [];

  // Deal order: player, dealer, player, dealer.
  playerCards.push(drawCard());
  dealerCards.push(drawCard());
  playerCards.push(drawCard());
  dealerCards.push(drawCard());

  const playerNatural = isNatural(playerCards);
  const dealerNatural = isNatural(dealerCards);

  if (!playerNatural && !dealerNatural) {
    const dealerUpcard = dealerCards[0]!;

    // Player hits per the fixed strategy table until it stands or busts.
    while (true) {
      if (handValue(playerCards).total > 21) break;
      if (!shouldPlayerHit(playerCards, dealerUpcard)) break;
      playerCards.push(drawCard());
    }

    const playerBusted = handValue(playerCards).total > 21;

    // Dealer only needs to play out its hand if the player hasn't already
    // busted (the round is decided either way).
    if (!playerBusted) {
      while (shouldDealerHit(dealerCards)) {
        dealerCards.push(drawCard());
      }
    }
  }

  const playerTotal = handValue(playerCards).total;
  const dealerTotal = handValue(dealerCards).total;
  const playerBusted = playerTotal > 21;
  const dealerBusted = dealerTotal > 21;

  let result: BlackjackResult;
  let multiplier: number;

  if (playerNatural && dealerNatural) {
    result = 'push';
    multiplier = 1.0;
  } else if (playerNatural) {
    result = 'blackjack';
    multiplier = applyHouseEdge(2.5);
  } else if (dealerNatural) {
    result = 'lose';
    multiplier = 0;
  } else if (playerBusted) {
    result = 'lose';
    multiplier = 0;
  } else if (dealerBusted) {
    result = 'win';
    multiplier = applyHouseEdge(2);
  } else if (playerTotal > dealerTotal) {
    result = 'win';
    multiplier = applyHouseEdge(2);
  } else if (playerTotal < dealerTotal) {
    result = 'lose';
    multiplier = 0;
  } else {
    result = 'push';
    multiplier = 1.0;
  }

  const payout = betAmount * multiplier;

  return {
    outcome: { playerCards, dealerCards, playerTotal, dealerTotal, result },
    multiplier,
    payout,
  };
}

function validateBlackjackParams(params: unknown): BlackjackParams {
  const result = BlackjackParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('blackjack', result.error.message);
  }
  return result.data;
}
