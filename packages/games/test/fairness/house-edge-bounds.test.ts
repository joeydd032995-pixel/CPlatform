// Deep fairness suite, part 4: house-edge monotonicity/sanity. Confirms no
// game configuration is ever positive-EV for the player, i.e.
//   multiplier * P(win) <= 1   for every reachable parameter combination.
//
// Analytic where the theoretical P(win) is known in closed form (Mines,
// Chicken, Keno, Darts, HiLo, Dice, Roulette, Plinko); Monte Carlo sampled
// where it isn't (Blackjack, whose strategy-table-driven RTP has no simple
// closed form -- see blackjack.test.ts's pinned ~0.9723 regression
// constant).
//
// All analytic loops here are fast (pure combinatorics, no RNG calls); the
// one sampled check (Blackjack) reuses a 20,000-round MC pass, fixed seed,
// deterministic.

import { describe, expect, it } from 'vitest';
import { nCrLocal } from './chi-square.js';
import { minesMultiplier, MINES_GAME_TILES_COUNT } from '../../src/mines.js';
import {
  chickenMultiplier,
  CHICKEN_LANES_COUNT,
  CHICKEN_DIFFICULTY_TO_SLICE,
  type ChickenDifficulty,
} from '../../src/chicken.js';
import {
  kenoMultiplierTable,
  KENO_GAME_TILES_COUNT,
  KENO_GAME_TILES_HIT_COUNT,
  type KenoRisk,
} from '../../src/keno.js';
import { DARTS_ZONES } from '../../src/darts.js';
import { resolveHiLo } from '../../src/hilo.js';
import { getCardRankValue, deck } from '../../src/deck.js';
import { applyHouseEdge } from '../../src/house-edge.js';
import { RouletteBetTypeSchema, rouletteMultiplier, type RouletteBetType } from '../../src/roulette.js';
import { getPlinkoMultipliersTable, PlinkoRisk } from '../../src/plinko.js';
import { resolveBlackjack } from '../../src/blackjack.js';

const EPS = 1e-9;

describe('Mines: multiplier * P(win) never exceeds 1, for every valid (mines, picks)', () => {
  it('holds for all mines in [1,24] and picks in [0, 25-mines]', () => {
    for (let mines = 1; mines <= 24; mines++) {
      for (let picks = 0; picks <= MINES_GAME_TILES_COUNT - mines; picks++) {
        const multiplier = minesMultiplier(mines, picks);
        const pWin =
          nCrLocal(MINES_GAME_TILES_COUNT - mines, picks) / nCrLocal(MINES_GAME_TILES_COUNT, picks);
        const ev = multiplier * pWin;
        expect(ev).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });
});

describe('Chicken: multiplier * P(win) never exceeds 1, for every valid (difficulty, lanes)', () => {
  it('holds for all four difficulties across their full lane range', () => {
    const difficulties: ChickenDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
    for (const difficulty of difficulties) {
      const d = CHICKEN_DIFFICULTY_TO_SLICE[difficulty];
      for (let lanes = 1; lanes <= CHICKEN_LANES_COUNT - d; lanes++) {
        const multiplier = chickenMultiplier(difficulty, lanes);
        const pWin =
          nCrLocal(CHICKEN_LANES_COUNT - lanes, d) / nCrLocal(CHICKEN_LANES_COUNT, d);
        const ev = multiplier * pWin;
        expect(ev).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });
});

describe('Keno: multiplier * P(hits=k) summed over k never exceeds 1', () => {
  function kenoHitProbability(N: number, k: number): number {
    return (
      (nCrLocal(N, k) * nCrLocal(KENO_GAME_TILES_COUNT - N, KENO_GAME_TILES_HIT_COUNT - k)) /
      nCrLocal(KENO_GAME_TILES_COUNT, KENO_GAME_TILES_HIT_COUNT)
    );
  }

  it('holds for every risk profile and picksCount 1..10', () => {
    const risks: KenoRisk[] = ['low', 'classic', 'medium', 'high'];
    for (const risk of risks) {
      for (let picksCount = 1; picksCount <= 10; picksCount++) {
        const table = kenoMultiplierTable(risk, picksCount);
        let ev = 0;
        for (let k = 0; k <= picksCount; k++) {
          ev += kenoHitProbability(picksCount, k) * table[k]!;
        }
        expect(ev).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });
});

describe('Darts: multiplier * P(zone) summed over all zones never exceeds 1', () => {
  it('Sigma(width * multiplier) <= 1', () => {
    const ev = DARTS_ZONES.reduce((sum, zone) => sum + (zone.to - zone.from) * zone.multiplier, 0);
    expect(ev).toBeLessThanOrEqual(1 + EPS);
  });
});

describe('HiLo: no single step, and no multi-step chain, is ever positive-EV', () => {
  // Under the "higher-or-equal" (>=) / "lower-or-equal" (<=) redesign,
  // favorable is always >= 4 (the current rank's own suits always count as
  // a win for BOTH guesses), so prob is always > 0 -- there is no longer a
  // "prob === 0 / auto-loss" branch to special-case here.
  it('every (card, guess) has p * multiplier === 0.99 exactly (<=1), for both guesses', () => {
    const guesses = ['higher', 'lower'] as const;
    for (const card of deck) {
      const rank = getCardRankValue(card);
      for (const guess of guesses) {
        const favorable = guess === 'higher' ? (14 - rank) * 4 : rank * 4;

        const prob = favorable / 52;
        expect(prob).toBeGreaterThan(0);

        const multiplier = resolveHiLo(card, guess);
        expect(prob * multiplier).toBeCloseTo(0.99, 9);
        expect(prob * multiplier).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });

  // Exact backward dynamic-programming computation of a chained guess
  // sequence's true expected value, over the 13 possible ranks (suit is
  // irrelevant -- each rank is drawn with probability 4/52 = 1/13 on every
  // independent, with-replacement draw). This is NOT Monte Carlo: it
  // enumerates every reachable rank transition exactly, so it is exact
  // (not just "converges with enough samples") and can never flake.
  function exactChainEV(guesses: readonly (typeof HILO_GUESSES)[number][]): number {
    const ranks = Array.from({ length: 13 }, (_, i) => i + 1);
    const cardForRank = (r: number) =>
      `♦${(['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'] as const)[r - 1]}` as (typeof deck)[number];

    let h = new Array(14).fill(1); // base case: no more steps left
    for (let step = guesses.length - 1; step >= 0; step--) {
      const guess = guesses[step]!;
      const nextH = new Array(14).fill(0);
      for (const c of ranks) {
        const multiplier = resolveHiLo(cardForRank(c), guess);
        let sum = 0;
        for (const cPrime of ranks) {
          const correct = guess === 'higher' ? cPrime >= c : cPrime <= c;
          if (correct) sum += (1 / 13) * h[cPrime]!;
        }
        nextH[c] = multiplier * sum;
      }
      h = nextH;
    }
    // Average over a uniformly random starting card's rank.
    return ranks.reduce((sum, c) => sum + (1 / 13) * h[c]!, 0);
  }

  const HILO_GUESSES = ['higher', 'lower'] as const;

  it('exact chained EV (backward DP over ranks) never exceeds 1, for representative guess sequences', () => {
    const sequences: (typeof HILO_GUESSES)[number][][] = [
      ['higher'],
      ['lower'],
      ['higher', 'lower'],
      ['higher', 'lower', 'higher'],
      ['higher', 'higher', 'higher'],
      ['lower', 'lower', 'lower', 'lower', 'lower'],
    ];

    for (const guesses of sequences) {
      const ev = exactChainEV(guesses);
      expect(ev).toBeLessThanOrEqual(1 + EPS);
    }
  });

  it('FIXED: under the >=/<= redesign, EVERY guess chain (any mix of higher/lower, any length) telescopes to exactly 0.99^n -- no correlation drag', () => {
    // Because favorable > 0 for every rank under both guesses, multiplier(c)
    // * prob(c) === 0.99 for every c with NO exceptions. By backward
    // induction this means the per-rank expected value at every step is a
    // CONSTANT 0.99^(remaining steps), independent of which rank you're
    // conditioning on -- so, unlike the old strict {higher,lower,equal}
    // model (which had a real prob=0 auto-loss on King/Ace that broke this
    // constant-h invariant and made chains compound far below 0.99^n), the
    // new model's chains are exactly fair regardless of guess mix.
    const sequences: (typeof HILO_GUESSES)[number][][] = [
      ['higher'],
      ['lower'],
      ['higher', 'higher'],
      ['higher', 'higher', 'higher'],
      ['lower', 'lower', 'lower'],
      ['higher', 'lower', 'higher', 'lower'],
    ];

    for (const guesses of sequences) {
      const ev = exactChainEV(guesses);
      expect(ev).toBeCloseTo(Math.pow(0.99, guesses.length), 9);
    }
  });
});

describe('Dice: multiplier * winChance/100 never exceeds 1, for every integer target 1..99', () => {
  it('holds for both directions', () => {
    for (let target = 1; target <= 99; target++) {
      for (const direction of ['over', 'under'] as const) {
        const winChance = direction === 'under' ? target : 100 - target;
        const multiplier = applyHouseEdge(100 / winChance);
        const ev = (winChance / 100) * multiplier;
        expect(ev).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });
});

describe('Roulette: multiplier * P(win) never exceeds 1, for every bet type', () => {
  const winProbabilityFor: Record<RouletteBetType, number> = {
    straight: 1 / 37,
    split: 2 / 37,
    street: 3 / 37,
    corner: 4 / 37,
    'six-line': 6 / 37,
    column: 12 / 37,
    dozen: 12 / 37,
    red: 18 / 37,
    black: 18 / 37,
    odd: 18 / 37,
    even: 18 / 37,
    high: 18 / 37,
    low: 18 / 37,
  };

  it('holds for every RouletteBetType', () => {
    for (const betType of RouletteBetTypeSchema.options) {
      const multiplier = rouletteMultiplier(betType);
      const ev = winProbabilityFor[betType] * multiplier;
      expect(ev).toBeLessThanOrEqual(1 + EPS);
    }
  });
});

describe('Plinko: multiplier * P(path) summed over all bucket indices never exceeds 1', () => {
  it('holds for every documented (rows, risk) table (8-16 rows)', () => {
    for (let rows = 8; rows <= 16; rows++) {
      for (const risk of Object.values(PlinkoRisk)) {
        const table = getPlinkoMultipliersTable({ risk, rows });
        let ev = 0;
        for (let index = 0; index <= rows; index++) {
          // Ball path is `rows` independent 50/50 left/right moves; landing
          // in bucket `index` (index = count of "right" moves) is Binomial(rows, 0.5).
          const pIndex = nCrLocal(rows, index) / Math.pow(2, rows);
          ev += pIndex * table[index]!;
        }
        expect(ev).toBeLessThanOrEqual(1 + 1e-6);
      }
    }
  });
});

describe('Blackjack: sampled EV stays <=1 despite the higher-variance payout structure', () => {
  it('MC-observed RTP over 20,000 rounds is comfortably below 1 (no positive-EV config exists)', () => {
    const BASE = {
      serverSeed: 'dd44'.repeat(16),
      clientSeed: 'fairness-house-edge',
      nonce: 0,
    };
    const rounds = 20000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveBlackjack({ ...BASE, nonce }, {}, betAmount);
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    // Pinned regression constant (blackjack.test.ts) is ~0.9723; give
    // generous margin (this is a sanity bound, not a precision check --
    // outcome-distributions.test.ts / rtp-convergence.test.ts own the tight
    // convergence assertions) but it must never reach or exceed 1.0.
    expect(observedRTP).toBeLessThan(1.0);
    expect(observedRTP).toBeGreaterThan(0.9);
  });
});
