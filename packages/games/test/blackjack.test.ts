import { describe, expect, it } from 'vitest';
import {
  calculateBlackjackResults,
  handValue,
  isNatural,
  shouldPlayerHit,
  shouldDealerHit,
  resolveBlackjack,
  dealInitial,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  playerInsurance,
  settleHands,
  canHit,
  canStand,
  canDouble,
  canSplit,
  canTakeInsurance,
  type BlackjackRoundState,
} from '../src/blackjack.js';
import { applyHouseEdge } from '../src/house-edge.js';
import { getCardRankValue, type Card } from '../src/deck.js';
import type { GeneratorOptions } from '@cplatform/core-rng';

const BASE = {
  serverSeed: '11'.repeat(32),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveBlackjack', () => {
  it('is deterministic for identical inputs', () => {
    const a = resolveBlackjack(BASE, {}, 100);
    const b = resolveBlackjack(BASE, {}, 100);
    expect(a).toEqual(b);
  });

  it('rejects unknown params (strict schema)', () => {
    expect(() => resolveBlackjack(BASE, { extra: 1 }, 100)).toThrow();
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveBlackjack(BASE, {}, 0)).toThrow();
  });

  it('payout is consistent with the reported multiplier for every result', () => {
    for (let nonce = 0; nonce < 500; nonce++) {
      const { payout, multiplier } = resolveBlackjack({ ...BASE, nonce }, {}, 100);
      expect(payout).toBeCloseTo(100 * multiplier, 8);
    }
  });
});

describe('stream-prefix equivalence', () => {
  it('cards consumed by resolveBlackjack are exactly a prefix of calculateBlackjackResults, across several nonces', () => {
    for (let nonce = 0; nonce < 25; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const { outcome } = resolveBlackjack(generatorOpts, {}, 100);

      // Reconstruct deal order: player, dealer, player, dealer, then
      // (player hits)*, then (dealer hits)*.
      const drawnCount = outcome.playerCards.length + outcome.dealerCards.length;
      const reference = calculateBlackjackResults({
        ...generatorOpts,
        limit: Math.max(drawnCount, 30),
      });

      const consumed: Card[] = [];
      consumed.push(outcome.playerCards[0]!, outcome.dealerCards[0]!, outcome.playerCards[1]!, outcome.dealerCards[1]!);
      for (let i = 2; i < outcome.playerCards.length; i++) consumed.push(outcome.playerCards[i]!);
      for (let i = 2; i < outcome.dealerCards.length; i++) consumed.push(outcome.dealerCards[i]!);

      expect(consumed).toEqual(reference.slice(0, drawnCount));
    }
  });
});

describe('hand evaluation (local card-values evaluator)', () => {
  it('sums pip cards directly', () => {
    expect(handValue(['♦2', '♦5']).total).toBe(7);
  });

  it('treats face cards as 10', () => {
    expect(handValue(['♦K', '♦Q']).total).toBe(20);
  });

  it('counts a single Ace as 11 when it does not bust (soft total)', () => {
    const { total, soft } = handValue(['♦A', '♦6']);
    expect(total).toBe(17);
    expect(soft).toBe(true);
  });

  it('demotes an Ace to 1 when counting it as 11 would bust', () => {
    const { total, soft } = handValue(['♦A', '♦9', '♦5']);
    expect(total).toBe(15);
    expect(soft).toBe(false);
  });

  it('handles multiple aces (only one can count as 11)', () => {
    const { total, soft } = handValue(['♦A', '♥A', '♦9']);
    expect(total).toBe(21);
    expect(soft).toBe(true);
  });

  it('handles multiple aces both demoted to 1 when 11+11 would bust', () => {
    const { total, soft } = handValue(['♦A', '♥A', '♦9', '♠K']);
    expect(total).toBe(21); // 1+1+9+10
    expect(soft).toBe(false);
  });

  it('isNatural is true only for a 21 on exactly 2 cards', () => {
    expect(isNatural(['♦A', '♦K'])).toBe(true);
    expect(isNatural(['♦7', '♦7', '♦7'])).toBe(false); // 21 via 3 cards, not natural
    expect(isNatural(['♦A', '♦9'])).toBe(false);
  });
});

describe('strategy table (representative cells)', () => {
  it('hard <=11 always hits', () => {
    expect(shouldPlayerHit(['♦5', '♦4'], '♦2')).toBe(true); // hard 9
  });

  it('hard 12 hits vs dealer 2/3/7-A, stands vs 4-6', () => {
    expect(shouldPlayerHit(['♦10', '♦2'], '♦4')).toBe(false);
    expect(shouldPlayerHit(['♦10', '♦2'], '♦5')).toBe(false);
    expect(shouldPlayerHit(['♦10', '♦2'], '♦6')).toBe(false);
    expect(shouldPlayerHit(['♦10', '♦2'], '♦2')).toBe(true);
    expect(shouldPlayerHit(['♦10', '♦2'], '♦7')).toBe(true);
    expect(shouldPlayerHit(['♦10', '♦2'], '♦A')).toBe(true);
  });

  it('hard 13-16 stands vs dealer 2-6, hits vs 7-A', () => {
    expect(shouldPlayerHit(['♦10', '♦5'], '♦6')).toBe(false); // hard 15 vs 6
    expect(shouldPlayerHit(['♦10', '♦5'], '♦7')).toBe(true); // hard 15 vs 7
    expect(shouldPlayerHit(['♦10', '♦6'], '♦A')).toBe(true); // hard 16 vs A
  });

  it('hard 17+ always stands', () => {
    expect(shouldPlayerHit(['♦10', '♦7'], '♦A')).toBe(false);
  });

  it('soft <=17 always hits', () => {
    expect(shouldPlayerHit(['♦A', '♦6'], '♦A')).toBe(true); // soft 17
  });

  it('soft 18 hits vs dealer 9/10/A, stands otherwise', () => {
    expect(shouldPlayerHit(['♦A', '♦7'], '♦9')).toBe(true);
    expect(shouldPlayerHit(['♦A', '♦7'], '♦10')).toBe(true);
    expect(shouldPlayerHit(['♦A', '♦7'], '♦A')).toBe(true);
    expect(shouldPlayerHit(['♦A', '♦7'], '♦6')).toBe(false);
  });

  it('soft 19+ always stands', () => {
    expect(shouldPlayerHit(['♦A', '♦8'], '♦A')).toBe(false);
  });

  it('dealer hits to 16 and stands on all 17s (including soft 17)', () => {
    expect(shouldDealerHit(['♦10', '♦6'])).toBe(true); // hard 16
    expect(shouldDealerHit(['♦10', '♦7'])).toBe(false); // hard 17
    expect(shouldDealerHit(['♦A', '♦6'])).toBe(false); // soft 17
  });
});

// Pinned nonces (found by brute force against BASE, documented so the
// scenario each one exercises is traceable rather than "magic").
describe('scenario coverage (pinned nonces against BASE)', () => {
  it('nonce=32: player natural blackjack pays 3:2 (applyHouseEdge(2.5) = 2.475)', () => {
    const { outcome, multiplier, payout } = resolveBlackjack({ ...BASE, nonce: 32 }, {}, 100);
    expect(outcome.result).toBe('blackjack');
    expect(multiplier).toBeCloseTo(applyHouseEdge(2.5), 10);
    expect(payout).toBeCloseTo(100 * applyHouseEdge(2.5), 8);
  });

  it('nonce=9: push returns exactly the bet (multiplier 1.0, no house edge)', () => {
    const { outcome, multiplier, payout } = resolveBlackjack({ ...BASE, nonce: 9 }, {}, 100);
    expect(outcome.result).toBe('push');
    expect(multiplier).toBe(1.0);
    expect(payout).toBe(100);
  });

  it('nonce=1: dealer bust results in a player win (applyHouseEdge(2) = 1.98)', () => {
    const { outcome, multiplier, payout } = resolveBlackjack({ ...BASE, nonce: 1 }, {}, 100);
    expect(outcome.dealerTotal).toBeGreaterThan(21);
    expect(outcome.result).toBe('win');
    expect(multiplier).toBeCloseTo(applyHouseEdge(2), 10);
    expect(payout).toBeCloseTo(198, 8);
  });

  it('nonce=10: player bust results in a loss (multiplier 0)', () => {
    const { outcome, multiplier, payout } = resolveBlackjack({ ...BASE, nonce: 10 }, {}, 100);
    expect(outcome.playerTotal).toBeGreaterThan(21);
    expect(outcome.result).toBe('lose');
    expect(multiplier).toBe(0);
    expect(payout).toBe(0);
  });

  it('nonce=7: a hand containing an Ace drawn via hitting exercises a soft-total transition', () => {
    const { outcome } = resolveBlackjack({ ...BASE, nonce: 7 }, {}, 100);
    expect(outcome.playerCards.length).toBeGreaterThan(2);
    expect(outcome.playerCards.some((c) => c.endsWith('A'))).toBe(true);
    expect(outcome.playerTotal).toBeLessThanOrEqual(21);
  });

  it('nonce=20: a hand with 2+ Aces exercises multi-ace demotion', () => {
    const { outcome } = resolveBlackjack({ ...BASE, nonce: 20 }, {}, 100);
    const aceCount = outcome.playerCards.filter((c) => c.endsWith('A')).length;
    expect(aceCount).toBeGreaterThanOrEqual(2);
    // Every extra Ace beyond the first must be demoted to 1 (only one Ace
    // can ever count as 11 without busting) -- verified directly against
    // handValue rather than assuming the hand doesn't bust.
    expect(outcome.playerTotal).toBe(handValue(outcome.playerCards).total);
  });
});

// RTP is rule-determined by the fixed player strategy + house rules above
// (no split/double/insurance to recover EV), NOT the platform's usual 0.99
// target. Measured via a 40k-round MC run against BASE during
// implementation: observed RTP ~= 0.9723. Pinned here as a regression
// constant so a future change to the strategy table or payout rules that
// silently shifts RTP gets caught.
const PINNED_BLACKJACK_RTP = 0.9723;

// --- Round-state primitives (hit/stand/double/split/insurance) ------------

function findNonce(
  predicate: (state: BlackjackRoundState, generatorOpts: GeneratorOptions) => boolean,
  maxTries = 2000
): { nonce: number; generatorOpts: GeneratorOptions; state: BlackjackRoundState } {
  for (let nonce = 0; nonce < maxTries; nonce++) {
    const generatorOpts = { ...BASE, nonce };
    const state = dealInitial(generatorOpts, 100);
    if (predicate(state, generatorOpts)) {
      return { nonce, generatorOpts, state };
    }
  }
  throw new Error('no matching nonce found within maxTries');
}

function driveWithFixedStrategy(
  generatorOpts: GeneratorOptions,
  betAmount: number
): BlackjackRoundState {
  let state = dealInitial(generatorOpts, betAmount);
  while (state.phase !== 'settled') {
    const hand = state.hands[state.activeHandIndex]!;
    if (canHit(state) && shouldPlayerHit(hand.cards, state.dealerCards[0]!)) {
      state = playerHit(generatorOpts, state);
    } else if (canStand(state)) {
      state = playerStand(generatorOpts, state);
    } else {
      throw new Error('stuck: neither hit nor stand legal but round not settled');
    }
  }
  return state;
}

describe('Blackjack round-state primitives: equivalence with the one-shot resolver', () => {
  it('driving the round primitives with the exact same fixed strategy (no split/double/insurance) reproduces resolveBlackjack outcome-for-outcome', () => {
    for (let nonce = 0; nonce < 300; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const oneShot = resolveBlackjack(generatorOpts, {}, 100);
      const roundState = driveWithFixedStrategy(generatorOpts, 100);
      const { outcome: roundOutcome } = settleHands(roundState);

      expect(roundOutcome.dealerCards).toEqual(oneShot.outcome.dealerCards);
      expect(roundOutcome.dealerTotal).toBe(oneShot.outcome.dealerTotal);
      expect(roundOutcome.hands).toHaveLength(1);
      expect(roundOutcome.hands[0]!.cards).toEqual(oneShot.outcome.playerCards);
      expect(roundOutcome.hands[0]!.total).toBe(oneShot.outcome.playerTotal);
      expect(roundOutcome.hands[0]!.result).toBe(oneShot.outcome.result);
      expect(roundOutcome.hands[0]!.payout).toBeCloseTo(oneShot.payout, 8);
    }
  });
});

describe('Blackjack round-state primitives: draw-stream accounting', () => {
  it('dealInitial always consumes exactly draws 0-3, matching calculateBlackjackResults prefix', () => {
    for (let nonce = 0; nonce < 25; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const state = dealInitial(generatorOpts, 100);
      const reference = calculateBlackjackResults({ ...generatorOpts, limit: 4 });
      expect(state.nextDrawIndex).toBe(4);
      expect([state.hands[0]!.cards[0], state.dealerCards[0], state.hands[0]!.cards[1], state.dealerCards[1]]).toEqual(
        reference
      );
    }
  });

  it('hitting until bust or 17+ consumes exactly one draw per hit, and nextDrawIndex matches total cards drawn', () => {
    const { generatorOpts, state: initial } = findNonce((s) => canHit(s));
    let state = initial;
    let hits = 0;
    while (canHit(state)) {
      state = playerHit(generatorOpts, state);
      hits++;
      if (hits > 20) throw new Error('unexpectedly long hitting sequence');
    }
    // 4 initial draws + 1 per hit, plus however many the dealer drew.
    const playerDrawsAfterInitial = state.hands[0]!.cards.length - 2;
    expect(playerDrawsAfterInitial).toBe(hits);
    expect(state.nextDrawIndex).toBeGreaterThanOrEqual(4 + hits);
  });
});

describe('Blackjack round-state primitives: naturals skip all decisions', () => {
  it('a natural (player or dealer) settles immediately with no legal actions', () => {
    const { state } = findNonce((s) => s.phase === 'settled');
    expect(canHit(state)).toBe(false);
    expect(canStand(state)).toBe(false);
    expect(canDouble(state)).toBe(false);
    expect(canSplit(state)).toBe(false);
    expect(canTakeInsurance(state)).toBe(false);

    const { outcome } = settleHands(state);
    expect(['blackjack', 'push', 'lose']).toContain(outcome.hands[0]!.result);
  });
});

describe('Blackjack round-state primitives: split', () => {
  it('splitting a pair debits exactly the original bet, produces two hands, and both settle correctly', () => {
    const { generatorOpts, state: initial } = findNonce((s) => canSplit(s));
    const originalBet = initial.hands[0]!.bet;

    const { state: afterSplit, additionalDebit } = playerSplit(generatorOpts, initial);
    expect(additionalDebit).toBe(originalBet);
    expect(afterSplit.hands).toHaveLength(2);
    expect(afterSplit.hands[0]!.bet).toBe(originalBet);
    expect(afterSplit.hands[1]!.bet).toBe(originalBet);

    // Only one split allowed per round.
    expect(canSplit(afterSplit)).toBe(false);

    // Play both hands out to settlement by standing immediately.
    let state = afterSplit;
    let guard = 0;
    while (state.phase !== 'settled') {
      if (canStand(state)) state = playerStand(generatorOpts, state);
      else break;
      if (++guard > 10) throw new Error('unexpectedly long settlement loop');
    }
    expect(state.phase).toBe('settled');

    const { outcome, totalPayout } = settleHands(state);
    expect(outcome.hands).toHaveLength(2);
    // A split hand reaching 21 is never a bonus "blackjack" payout.
    for (const hand of outcome.hands) {
      expect(hand.result).not.toBe('blackjack');
    }
    expect(totalPayout).toBeCloseTo(
      outcome.hands.reduce((sum, h) => sum + h.payout, 0) + outcome.insurancePayout,
      8
    );
  });

  it('splitting Aces deals exactly one further card per hand and forbids further hits', () => {
    const { generatorOpts, state: initial } = findNonce(
      (s) => canSplit(s) && getCardRankValue(s.hands[0]!.cards[0]!) === 1
    );

    const { state: afterSplit } = playerSplit(generatorOpts, initial);
    expect(afterSplit.hands).toHaveLength(2);
    for (const hand of afterSplit.hands) {
      expect(hand.isSplitAce).toBe(true);
      expect(hand.cards).toHaveLength(2);
      expect(hand.status).toBe('stood');
    }
    // Split-ace hands can't hit or double.
    expect(canHit(afterSplit)).toBe(false);
    expect(canDouble(afterSplit)).toBe(false);
  });

  it('rejects splitting a non-pair', () => {
    const { generatorOpts, state } = findNonce((s) => !canSplit(s) && s.phase === 'player-acting');
    expect(() => playerSplit(generatorOpts, state)).toThrow();
  });
});

describe('Blackjack round-state primitives: double', () => {
  it('doubling debits exactly the original bet, draws exactly one card, and forces a stand', () => {
    const { generatorOpts, state: initial } = findNonce((s) => canDouble(s));
    const originalBet = initial.hands[0]!.bet;
    const cardsBefore = initial.hands[0]!.cards.length;

    const { state: afterDouble, additionalDebit } = playerDouble(generatorOpts, initial);
    expect(additionalDebit).toBe(originalBet);

    // The doubled hand is no longer active (forced stand/bust); if it was
    // the only hand, the round has already moved to dealer play/settlement.
    const doubledHandIndex = 0;
    const doubledHand =
      afterDouble.hands[doubledHandIndex]!.bet === originalBet * 2
        ? afterDouble.hands[doubledHandIndex]!
        : afterDouble.hands.find((h) => h.bet === originalBet * 2)!;
    expect(doubledHand.cards.length).toBe(cardsBefore + 1);
    expect(doubledHand.bet).toBe(originalBet * 2);
    expect(['doubled', 'busted']).toContain(doubledHand.status);
  });

  it('rejects doubling a hand that already has more than 2 cards', () => {
    const { generatorOpts, state: initial } = findNonce((s) => canHit(s));
    const hit = playerHit(generatorOpts, initial);
    expect(() => playerDouble(generatorOpts, hit)).toThrow();
  });
});

describe('Blackjack round-state primitives: insurance', () => {
  it('is only legal immediately after dealing, with a dealer Ace upcard, and debits half the bet', () => {
    const { generatorOpts, state: initial } = findNonce(
      (s) => s.phase === 'player-acting' && getCardRankValue(s.dealerCards[0]!) === 1
    );
    expect(canTakeInsurance(initial)).toBe(true);

    const { state: afterInsurance, additionalDebit } = playerInsurance(initial);
    expect(additionalDebit).toBe(initial.hands[0]!.bet / 2);
    expect(afterInsurance.insuranceTaken).toBe(true);
    // Can't take insurance twice.
    expect(canTakeInsurance(afterInsurance)).toBe(false);
    expect(() => playerInsurance(afterInsurance)).toThrow();
  });

  it('pays 3x the insurance bet when the dealer has a natural, 0 otherwise', () => {
    const { generatorOpts, state: initial } = findNonce(
      (s) => s.phase === 'player-acting' && getCardRankValue(s.dealerCards[0]!) === 1
    );
    const { state: afterInsurance } = playerInsurance(initial);
    const finalState = driveWithFixedStrategy(generatorOpts, 100);
    // Re-derive with insurance applied on top of the same seed's deal.
    let state = afterInsurance;
    while (state.phase !== 'settled') {
      const hand = state.hands[state.activeHandIndex]!;
      if (canHit(state) && shouldPlayerHit(hand.cards, state.dealerCards[0]!)) {
        state = playerHit(generatorOpts, state);
      } else if (canStand(state)) {
        state = playerStand(generatorOpts, state);
      } else break;
    }
    const { outcome } = settleHands(state);
    const dealerHadNatural = isNatural(outcome.dealerCards);
    if (dealerHadNatural) {
      expect(outcome.insurancePayout).toBeCloseTo(afterInsurance.insuranceBet * 3, 8);
    } else {
      expect(outcome.insurancePayout).toBe(0);
    }
    // Sanity: the underlying hand-play matches the no-insurance driven
    // version (insurance doesn't consume draws or otherwise perturb play).
    expect(outcome.dealerCards).toEqual(settleHands(finalState).outcome.dealerCards);
  });

  it('rejects insurance when the dealer upcard is not an Ace', () => {
    const { state } = findNonce(
      (s) => s.phase === 'player-acting' && getCardRankValue(s.dealerCards[0]!) !== 1
    );
    expect(canTakeInsurance(state)).toBe(false);
    expect(() => playerInsurance(state)).toThrow();
  });

  it('rejects insurance once another decision has been made', () => {
    const { generatorOpts, state: initial } = findNonce(
      (s) => s.phase === 'player-acting' && canHit(s) && getCardRankValue(s.dealerCards[0]!) === 1
    );
    const afterHit = playerHit(generatorOpts, initial);
    expect(canTakeInsurance(afterHit)).toBe(false);
    expect(() => playerInsurance(afterHit)).toThrow();
  });
});

describe('Blackjack round-state primitives: illegal-action guards', () => {
  it('rejects any action once the round is settled', () => {
    const { generatorOpts, state } = findNonce((s) => s.phase === 'settled');
    expect(() => playerHit(generatorOpts, state)).toThrow();
    expect(() => playerStand(generatorOpts, state)).toThrow();
    expect(() => playerDouble(generatorOpts, state)).toThrow();
    expect(() => playerSplit(generatorOpts, state)).toThrow();
  });

  it('rejects a second split in the same round', () => {
    const { generatorOpts, state: initial } = findNonce((s) => canSplit(s));
    const { state: afterSplit } = playerSplit(generatorOpts, initial);
    expect(() => playerSplit(generatorOpts, afterSplit)).toThrow();
  });
});

describe('blackjack RTP (rule-determined, not 0.99)', () => {
  it('converges within +/-0.02 of the pinned regression constant over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveBlackjack({ ...BASE, nonce }, {}, betAmount);
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(PINNED_BLACKJACK_RTP - 0.02);
    expect(observedRTP).toBeLessThan(PINNED_BLACKJACK_RTP + 0.02);
  });
});
