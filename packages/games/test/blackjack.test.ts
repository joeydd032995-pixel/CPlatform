import { describe, expect, it } from 'vitest';
import {
  calculateBlackjackResults,
  handValue,
  isNatural,
  shouldPlayerHit,
  shouldDealerHit,
  resolveBlackjack,
} from '../src/blackjack.js';
import { applyHouseEdge } from '../src/house-edge.js';
import type { Card } from '../src/deck.js';

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
