// RTP convergence + decision-level EV-neutrality tests for the new
// round-state Blackjack primitives (hit/stand/double/split/insurance).
//
// The existing PINNED_BLACKJACK_RTP (0.9723, in blackjack.test.ts and
// rtp-convergence.test.ts) validates the UNCHANGED one-shot resolveBlackjack
// -- a fixed auto-play resolver with zero player decisions -- and stays
// exactly as-is. It does NOT apply here: splits and doubles are real
// EV-recovering plays unavailable to that fixed resolver, so the
// decision-based path's true RTP had to be empirically simulated rather
// than assumed to match 0.9723. This file's pinned constant below is that
// simulated figure.

import { describe, expect, it } from 'vitest';
import {
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
  shouldPlayerHit,
  handValue,
  type BlackjackRoundState,
} from '../../src/blackjack.js';
import { getCardRankValue } from '../../src/deck.js';
import type { GeneratorOptions } from '@cplatform/core-rng';

const BASE = {
  serverSeed: 'dd44'.repeat(16),
  clientSeed: 'blackjack-decision-rtp',
  nonce: 0,
};

// Simplified basic-strategy bot: reuses the exact same shouldPlayerHit table
// resolveBlackjack itself uses for hit/stand, and adds the classic
// universally-recommended splits (Aces, 8s) plus a simplified hard-10/11
// double rule. This is not claimed to be maximally optimal (e.g. no
// soft-doubling, no dealer-upcard-conditioned split/double refinement) --
// it's a reasonable, deterministic strategy sufficient to establish an
// empirical RTP baseline for the decision-based primitives.
function shouldSplit(hand: BlackjackRoundState['hands'][number]): boolean {
  const rank = getCardRankValue(hand.cards[0]!);
  return rank === 1 || rank === 8; // Aces and 8s
}

function shouldDouble(hand: BlackjackRoundState['hands'][number]): boolean {
  const { total, soft } = handValue(hand.cards);
  if (soft) return false;
  return total === 10 || total === 11;
}

function driveBasicStrategyBot(
  generatorOpts: GeneratorOptions,
  betAmount: number,
  takeInsurance: boolean
): { totalDebit: number; totalPayout: number } {
  let state = dealInitial(generatorOpts, betAmount);
  let totalDebit = betAmount;

  if (takeInsurance && canTakeInsurance(state)) {
    const r = playerInsurance(state);
    state = r.state;
    totalDebit += r.additionalDebit;
  }

  while (state.phase !== 'settled') {
    const hand = state.hands[state.activeHandIndex]!;
    const dealerUpcard = state.dealerCards[0]!;

    if (canSplit(state) && shouldSplit(hand)) {
      const r = playerSplit(generatorOpts, state);
      state = r.state;
      totalDebit += r.additionalDebit;
      continue;
    }
    if (canDouble(state) && shouldDouble(hand)) {
      const r = playerDouble(generatorOpts, state);
      state = r.state;
      totalDebit += r.additionalDebit;
      continue;
    }
    if (canHit(state) && shouldPlayerHit(hand.cards, dealerUpcard)) {
      state = playerHit(generatorOpts, state);
      continue;
    }
    if (canStand(state)) {
      state = playerStand(generatorOpts, state);
      continue;
    }
    throw new Error('stuck: no legal action but round not settled');
  }

  const { totalPayout } = settleHands(state);
  return { totalDebit, totalPayout };
}

// Empirically simulated (100,000-round Monte Carlo run against BASE during
// implementation, no insurance -- insurance is a well-known -EV side bet
// for a non-counting player, see the dedicated EV-neutrality test below,
// and a bot that never takes it plays optimally in that respect): observed
// RTP ~= 0.98573. Adding splits/doubles on top of the fixed hit/stand table
// recovers real EV relative to the no-decisions resolver, so this sits
// meaningfully above the unmodified one-shot resolver's pinned 0.9723 --
// re-simulate and update this constant if the primitives or the bot's
// strategy ever change.
const PINNED_DECISION_BLACKJACK_RTP = 0.9857;

describe('Blackjack decision-based RTP convergence (splits/doubles, no insurance)', () => {
  it(`converges to the pinned ${PINNED_DECISION_BLACKJACK_RTP} +/- 0.02 over 30,000 rounds`, () => {
    const rounds = 30000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { totalDebit, totalPayout: payout } = driveBasicStrategyBot(
        { ...BASE, nonce },
        betAmount,
        false
      );
      totalPayout += payout;
      totalWagered += totalDebit;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(PINNED_DECISION_BLACKJACK_RTP - 0.02);
    expect(observedRTP).toBeLessThan(PINNED_DECISION_BLACKJACK_RTP + 0.02);
  });
});

describe('Blackjack decision-level EV-neutrality (fixed spot checks)', () => {
  it('always taking insurance is worse EV than never taking it (insurance is a -EV side bet)', () => {
    const betAmount = 100;
    const rounds = 4000;
    let totalDebitWith = 0;
    let totalPayoutWith = 0;
    let totalDebitWithout = 0;
    let totalPayoutWithout = 0;
    let scenarios = 0;

    for (let nonce = 0; nonce < 50000 && scenarios < rounds; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const probe = dealInitial(generatorOpts, betAmount);
      if (!canTakeInsurance(probe)) continue;
      scenarios++;

      const withIns = driveBasicStrategyBot(generatorOpts, betAmount, true);
      totalDebitWith += withIns.totalDebit;
      totalPayoutWith += withIns.totalPayout;

      const withoutIns = driveBasicStrategyBot(generatorOpts, betAmount, false);
      totalDebitWithout += withoutIns.totalDebit;
      totalPayoutWithout += withoutIns.totalPayout;
    }

    expect(scenarios).toBeGreaterThan(rounds * 0.5);
    const rtpWith = totalPayoutWith / totalDebitWith;
    const rtpWithout = totalPayoutWithout / totalDebitWithout;
    expect(rtpWith).toBeLessThan(rtpWithout);
  });

  it('hitting a hard 16 vs. a strong dealer upcard (7-A) has higher EV than standing (well-established basic-strategy fact)', () => {
    // Note: this fact only holds against a STRONG dealer upcard (7-A) --
    // vs. a weak upcard (2-6) standing is actually correct (the dealer is
    // more likely to bust), which is exactly what shouldPlayerHit's own
    // table encodes (`total 13-16` hits only when `!(upcard 2-6)`). An
    // earlier version of this test aggregated across ALL dealer upcards and
    // incorrectly failed -- mixing the two regimes together washes out the
    // effect this test is meant to isolate.
    const betAmount = 100;
    const rounds = 1500;
    let hitPayout = 0;
    let hitDebit = 0;
    let standPayout = 0;
    let standDebit = 0;
    let scenarios = 0;

    for (let nonce = 0; nonce < 400000 && scenarios < rounds; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const initial = dealInitial(generatorOpts, betAmount);
      if (initial.phase === 'settled') continue;
      const hand = initial.hands[0]!;
      const { total, soft } = handValue(hand.cards);
      if (soft || total !== 16) continue;
      const upcardRank = getCardRankValue(initial.dealerCards[0]!);
      const isStrongUpcard = upcardRank === 1 || upcardRank >= 7;
      if (!isStrongUpcard) continue;
      scenarios++;

      const hitState = playerHit(generatorOpts, initial);
      // Finish the hand by always standing after this point (isolating the
      // hit-vs-stand decision at 16 itself, not compounding further choices).
      let s1 = hitState;
      while (s1.phase !== 'settled') {
        if (canStand(s1)) s1 = playerStand(generatorOpts, s1);
        else break;
      }
      hitPayout += settleHands(s1).totalPayout;
      hitDebit += betAmount;

      const standState = playerStand(generatorOpts, initial);
      let s2 = standState;
      while (s2.phase !== 'settled') {
        if (canStand(s2)) s2 = playerStand(generatorOpts, s2);
        else break;
      }
      standPayout += settleHands(s2).totalPayout;
      standDebit += betAmount;
    }

    expect(scenarios).toBeGreaterThan(rounds * 0.5);
    const hitRTP = hitPayout / hitDebit;
    const standRTP = standPayout / standDebit;
    expect(hitRTP).toBeGreaterThan(standRTP);
  });

  it('standing on a hard 20 has higher EV than hitting (obviously correct sanity check)', () => {
    const betAmount = 100;
    const rounds = 800;
    let hitPayout = 0;
    let hitDebit = 0;
    let standPayout = 0;
    let standDebit = 0;
    let scenarios = 0;

    for (let nonce = 0; nonce < 300000 && scenarios < rounds; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const initial = dealInitial(generatorOpts, betAmount);
      if (initial.phase === 'settled') continue;
      const hand = initial.hands[0]!;
      const { total, soft } = handValue(hand.cards);
      if (soft || total !== 20) continue;
      scenarios++;

      const hitState = playerHit(generatorOpts, initial);
      let s1 = hitState;
      while (s1.phase !== 'settled') {
        if (canStand(s1)) s1 = playerStand(generatorOpts, s1);
        else break;
      }
      hitPayout += settleHands(s1).totalPayout;
      hitDebit += betAmount;

      const standState = playerStand(generatorOpts, initial);
      let s2 = standState;
      while (s2.phase !== 'settled') {
        if (canStand(s2)) s2 = playerStand(generatorOpts, s2);
        else break;
      }
      standPayout += settleHands(s2).totalPayout;
      standDebit += betAmount;
    }

    expect(scenarios).toBeGreaterThan(rounds * 0.3);
    const hitRTP = hitPayout / hitDebit;
    const standRTP = standPayout / standDebit;
    expect(standRTP).toBeGreaterThan(hitRTP);
  });
});
