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

// --- Round-state primitives (real-time hit/stand/double/split/insurance) --
//
// Unlike Mines, real decisions here genuinely branch the float-draw
// stream (different choices consume different numbers of draws), so this
// is new logic rather than a decomposition of resolveBlackjack (which stays
// completely unchanged above, still backing the one-shot dispatch path).
//
// Determinism/verifiability contract (do not change once shipped -- this is
// exactly what a later replay/verify call must reproduce):
//   1. Draw K is always createFloatGenerator(generatorOpts) advanced K times
//      -- one shared stream for the whole round, tracked by a single
//      `nextDrawIndex` cursor, matching resolveBlackjack's own stream.
//   2. Initial deal always consumes draws 0-3 (player, dealer, player,
//      dealer), identical to resolveBlackjack, regardless of later
//      decisions.
//   3. Splits are capped at one per round (max 2 hands). On split, the
//      first split hand is dealt its second card and played to completion
//      (every hit, in order) BEFORE the second split hand draws its own
//      second card. Split aces get exactly one further card and no hits.
//   4. Double consumes exactly one draw, then forces that hand to stand.
//   5. Insurance consumes zero draws (resolved against the already-dealt
//      dealer hole card) and is only legal before any other decision.
//   6. The dealer only plays out after every hand is done (stood/busted/
//      doubled/split-ace-stood), and only draws further cards at all if at
//      least one hand hasn't busted -- matching resolveBlackjack.
//   7. Naturals (21 on the initial, un-split, 2-card hand) are only
//      recognized at the initial deal, exactly as in resolveBlackjack; a
//      split hand reaching 21 is a normal strong hand, not a bonus payout.

export type BlackjackHandStatus = 'active' | 'stood' | 'busted' | 'doubled';

export type BlackjackHandState = {
  cards: Card[];
  bet: number;
  status: BlackjackHandStatus;
  isSplitAce?: boolean;
};

export type BlackjackRoundPhase = 'player-acting' | 'settled';

export type BlackjackRoundState = {
  hands: BlackjackHandState[];
  activeHandIndex: number;
  dealerCards: Card[];
  nextDrawIndex: number;
  insuranceTaken: boolean;
  insuranceBet: number;
  phase: BlackjackRoundPhase;
};

export type BlackjackHandOutcome = {
  bet: number;
  cards: Card[];
  total: number;
  result: BlackjackResult;
  payout: number;
};

export type BlackjackRoundOutcome = {
  dealerCards: Card[];
  dealerTotal: number;
  hands: BlackjackHandOutcome[];
  insurancePayout: number;
};

// Draw K is, by spec, createFloatGenerator(opts) advanced K+1 times (0-indexed).
// Recreating the generator each call is O(n) per draw, but hands here are
// small (a handful of draws even with a split+double), so this is simplest
// and most obviously correct -- each round-state action is a separate
// service call anyway, with no persistent generator between requests; only
// `nextDrawIndex` is carried across calls, in the persisted Round row.
function drawCardAtIndex(generatorOpts: GeneratorOptions, index: number): Card {
  const floatsRng = createFloatGenerator(generatorOpts);
  let float = 0;
  for (let i = 0; i <= index; i++) {
    float = floatsRng.next().value;
  }
  return drawCardFromFloat(float);
}

function invalid(message: string): never {
  throw new InvalidBetParamsError('blackjack', message);
}

function isHandActive(hand: BlackjackHandState): boolean {
  return hand.status === 'active';
}

export function canHit(state: BlackjackRoundState): boolean {
  if (state.phase !== 'player-acting') return false;
  const hand = state.hands[state.activeHandIndex];
  return !!hand && hand.status === 'active' && hand.cards.length >= 2 && !hand.isSplitAce;
}

export function canStand(state: BlackjackRoundState): boolean {
  return canHit(state);
}

export function canDouble(state: BlackjackRoundState): boolean {
  if (state.phase !== 'player-acting') return false;
  const hand = state.hands[state.activeHandIndex];
  return !!hand && hand.status === 'active' && hand.cards.length === 2 && !hand.isSplitAce;
}

export function canSplit(state: BlackjackRoundState): boolean {
  if (state.phase !== 'player-acting') return false;
  if (state.hands.length >= 2) return false;
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.status !== 'active' || hand.cards.length !== 2) return false;
  return getCardRankValue(hand.cards[0]!) === getCardRankValue(hand.cards[1]!);
}

export function canTakeInsurance(state: BlackjackRoundState): boolean {
  if (state.phase !== 'player-acting') return false;
  if (state.insuranceTaken) return false;
  if (state.hands.length !== 1 || state.hands[0]!.cards.length !== 2) return false;
  return getCardRankValue(state.dealerCards[0]!) === 1;
}

export function dealInitial(
  generatorOpts: GeneratorOptions,
  betAmount: number
): BlackjackRoundState {
  validateBetAmount('blackjack', betAmount);

  let nextDrawIndex = 0;
  const draw = (): Card => {
    const card = drawCardAtIndex(generatorOpts, nextDrawIndex);
    nextDrawIndex += 1;
    return card;
  };

  const playerCards: Card[] = [];
  const dealerCards: Card[] = [];
  // Deal order: player, dealer, player, dealer -- identical to resolveBlackjack.
  playerCards.push(draw());
  dealerCards.push(draw());
  playerCards.push(draw());
  dealerCards.push(draw());

  const settledImmediately = isNatural(playerCards) || isNatural(dealerCards);

  const hand: BlackjackHandState = {
    cards: playerCards,
    bet: betAmount,
    status: settledImmediately ? 'stood' : 'active',
  };

  return {
    hands: [hand],
    activeHandIndex: 0,
    dealerCards,
    nextDrawIndex,
    insuranceTaken: false,
    insuranceBet: 0,
    phase: settledImmediately ? 'settled' : 'player-acting',
  };
}

export function playerHit(
  generatorOpts: GeneratorOptions,
  state: BlackjackRoundState
): BlackjackRoundState {
  if (!canHit(state)) invalid('hit is not legal in the current state');

  const hand = state.hands[state.activeHandIndex]!;
  const card = drawCardAtIndex(generatorOpts, state.nextDrawIndex);
  const newCards = [...hand.cards, card];
  const total = handValue(newCards).total;

  const hands = state.hands.slice();
  hands[state.activeHandIndex] = {
    ...hand,
    cards: newCards,
    status: total > 21 ? 'busted' : 'active',
  };

  return advanceToNextHandOrDealer(generatorOpts, {
    ...state,
    hands,
    nextDrawIndex: state.nextDrawIndex + 1,
  });
}

export function playerStand(
  generatorOpts: GeneratorOptions,
  state: BlackjackRoundState
): BlackjackRoundState {
  if (!canStand(state)) invalid('stand is not legal in the current state');

  const hand = state.hands[state.activeHandIndex]!;
  const hands = state.hands.slice();
  hands[state.activeHandIndex] = { ...hand, status: 'stood' };

  return advanceToNextHandOrDealer(generatorOpts, { ...state, hands });
}

export function playerDouble(
  generatorOpts: GeneratorOptions,
  state: BlackjackRoundState
): { state: BlackjackRoundState; additionalDebit: number } {
  if (!canDouble(state)) invalid('double is not legal in the current state');

  const hand = state.hands[state.activeHandIndex]!;
  const card = drawCardAtIndex(generatorOpts, state.nextDrawIndex);
  const newCards = [...hand.cards, card];
  const total = handValue(newCards).total;

  const hands = state.hands.slice();
  hands[state.activeHandIndex] = {
    ...hand,
    cards: newCards,
    bet: hand.bet * 2,
    status: total > 21 ? 'busted' : 'doubled',
  };

  const nextState = advanceToNextHandOrDealer(generatorOpts, {
    ...state,
    hands,
    nextDrawIndex: state.nextDrawIndex + 1,
  });
  return { state: nextState, additionalDebit: hand.bet };
}

export function playerSplit(
  generatorOpts: GeneratorOptions,
  state: BlackjackRoundState
): { state: BlackjackRoundState; additionalDebit: number } {
  if (!canSplit(state)) invalid('split is not legal in the current state');

  const hand = state.hands[state.activeHandIndex]!;
  const [cardA, cardB] = hand.cards;
  const isAceSplit = getCardRankValue(cardA!) === 1;

  // Only hand 1 is dealt its second card now; hand 2 gets its second card
  // once play advances to it (see advanceToNextHandOrDealer) -- this is the
  // fixed linear draw order the verifiability contract depends on.
  const card = drawCardAtIndex(generatorOpts, state.nextDrawIndex);
  const firstHand: BlackjackHandState = {
    cards: [cardA!, card],
    bet: hand.bet,
    status: isAceSplit ? 'stood' : 'active',
    isSplitAce: isAceSplit,
  };
  const secondHand: BlackjackHandState = {
    cards: [cardB!],
    bet: hand.bet,
    status: 'active',
    isSplitAce: isAceSplit,
  };

  const nextState = advanceToNextHandOrDealer(generatorOpts, {
    ...state,
    hands: [firstHand, secondHand],
    activeHandIndex: 0,
    nextDrawIndex: state.nextDrawIndex + 1,
  });
  return { state: nextState, additionalDebit: hand.bet };
}

export function playerInsurance(state: BlackjackRoundState): {
  state: BlackjackRoundState;
  additionalDebit: number;
} {
  if (!canTakeInsurance(state)) invalid('insurance is not legal in the current state');

  const insuranceBet = state.hands[0]!.bet / 2;
  return {
    state: { ...state, insuranceTaken: true, insuranceBet },
    additionalDebit: insuranceBet,
  };
}

// Moves play to the next hand awaiting a decision, dealing a fresh split
// hand's second card first if needed; once every hand is done, plays the
// dealer out (only if at least one hand hasn't busted) and settles the
// round. Called after every hand-terminating action (bust/stand/double) and
// after a split.
export function advanceToNextHandOrDealer(
  generatorOpts: GeneratorOptions,
  state: BlackjackRoundState
): BlackjackRoundState {
  const current = state.hands[state.activeHandIndex];

  // A freshly-split hand only has one card so far -- deal its second card
  // before anything else, then re-check (a dealt ace-split hand immediately
  // stands, so it may need to advance again right away).
  if (current && current.status === 'active' && current.cards.length === 1) {
    const card = drawCardAtIndex(generatorOpts, state.nextDrawIndex);
    const newCards = [...current.cards, card];
    const hands = state.hands.slice();
    hands[state.activeHandIndex] = {
      ...current,
      cards: newCards,
      status: current.isSplitAce ? 'stood' : 'active',
    };
    return advanceToNextHandOrDealer(generatorOpts, {
      ...state,
      hands,
      nextDrawIndex: state.nextDrawIndex + 1,
    });
  }

  // Still mid-decision on a fully-dealt hand -- nothing to advance yet.
  if (current && isHandActive(current)) return state;

  // Move to the next hand (if any) still awaiting a decision.
  for (let i = state.activeHandIndex + 1; i < state.hands.length; i++) {
    if (isHandActive(state.hands[i]!)) {
      return advanceToNextHandOrDealer(generatorOpts, { ...state, activeHandIndex: i });
    }
  }

  // Every hand is done -- play the dealer out, unless every hand busted
  // (the round is already decided either way, matching resolveBlackjack).
  const anyHandStillInPlay = state.hands.some((h) => h.status !== 'busted');
  let dealerCards = state.dealerCards;
  let nextDrawIndex = state.nextDrawIndex;
  if (anyHandStillInPlay) {
    while (shouldDealerHit(dealerCards)) {
      const card = drawCardAtIndex(generatorOpts, nextDrawIndex);
      dealerCards = [...dealerCards, card];
      nextDrawIndex += 1;
    }
  }

  return { ...state, dealerCards, nextDrawIndex, phase: 'settled' };
}

export function settleHands(state: BlackjackRoundState): {
  outcome: BlackjackRoundOutcome;
  totalPayout: number;
} {
  if (state.phase !== 'settled') invalid('round is not yet settled');

  const dealerTotal = handValue(state.dealerCards).total;
  const dealerBusted = dealerTotal > 21;
  const dealerNatural = isNatural(state.dealerCards);
  const singleUnsplitHand = state.hands.length === 1;

  const hands: BlackjackHandOutcome[] = state.hands.map((hand) => {
    const total = handValue(hand.cards).total;
    const playerBusted = total > 21;
    // Naturals are only recognized on the initial, un-split, 2-card hand --
    // never on a split hand, matching common casino rules and
    // resolveBlackjack's own "only the initial two cards" semantics.
    const playerNatural = singleUnsplitHand && hand.cards.length === 2 && isNatural(hand.cards);

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
    } else if (total > dealerTotal) {
      result = 'win';
      multiplier = applyHouseEdge(2);
    } else if (total < dealerTotal) {
      result = 'lose';
      multiplier = 0;
    } else {
      result = 'push';
      multiplier = 1.0;
    }

    return { bet: hand.bet, cards: hand.cards, total, result, payout: hand.bet * multiplier };
  });

  // Insurance is a true 2:1 side bet (not house-edge-adjusted, matching how
  // it's never modeled elsewhere in this engine): a win credits the stake
  // back plus double profit, i.e. 3x the insurance bet total.
  const insurancePayout = state.insuranceTaken && dealerNatural ? state.insuranceBet * 3 : 0;
  const totalPayout = hands.reduce((sum, h) => sum + h.payout, 0) + insurancePayout;

  return {
    outcome: { dealerCards: state.dealerCards, dealerTotal, hands, insurancePayout },
    totalPayout,
  };
}
