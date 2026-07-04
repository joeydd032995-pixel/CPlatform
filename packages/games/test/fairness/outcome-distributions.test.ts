// Deep fairness suite, part 2: chi-square goodness-of-fit against each
// game's KNOWN theoretical outcome distribution (uniform where the game
// itself is uniform, and the actual non-uniform shape where it isn't --
// Darts zones and Chicken deathPoint above 'easy' are NOT uniform, and
// asserting uniformity for them would be testing the wrong thing).
//
// This goes deeper than the existing per-game tests' +/-20% bucket checks:
// every assertion here is "chi-square statistic < critical value at
// alpha=0.01" rather than a fixed percentage band, and the expected
// distribution is the actual combinatorial theory, not just "flat".
//
// Iteration counts (all fixed-seed, deterministic, no gating needed --
// these are single-draw-per-round tests, cheap even at these N):
//   dice: 25,000 | roulette: 37,000 | keno tiles: 20,000 | mines: 25,000
//   chicken (x4 difficulties): 20,000 each | darts: 40,000 | hilo: 52,000
// Total ~250k rounds across this file, each round is O(1) HMAC draws
// (1-20 depending on the game) -- runs in low single-digit seconds.

import { describe, expect, it } from 'vitest';
import { calculateDiceRoll } from '../../src/dice.js';
import { calculateRouletteResult } from '../../src/roulette.js';
import { calculateKenoHitPositions, KENO_GAME_TILES_COUNT } from '../../src/keno.js';
import { calculateMinesPositions, MINES_GAME_TILES_COUNT } from '../../src/mines.js';
import {
  calculateChickenDeathPoint,
  CHICKEN_DIFFICULTY_TO_SLICE,
  CHICKEN_LANES_COUNT,
  type ChickenDifficulty,
} from '../../src/chicken.js';
import { calculateDartThrow, dartsZoneForDistance, DARTS_ZONES } from '../../src/darts.js';
import { calculateHiloResults } from '../../src/hilo.js';
import { deck } from '../../src/deck.js';
import { chiSquareCriticalValue, chiSquareGoodnessOfFit, nCrLocal } from './chi-square.js';

const BASE = {
  serverSeed: 'bb22'.repeat(16),
  clientSeed: 'fairness-distributions',
  nonce: 0,
};

describe('Dice: roll uniform over [0,100] (25 buckets, N=25,000)', () => {
  it('chi-square statistic is below the alpha=0.01 critical value', () => {
    const bucketCount = 25;
    const rounds = 25000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const roll = calculateDiceRoll({ ...BASE, nonce });
      const bucket = Math.min(bucketCount - 1, Math.floor((roll / 100) * bucketCount));
      buckets[bucket]++;
    }

    const stat = chiSquareGoodnessOfFit(
      buckets,
      new Array(bucketCount).fill(1 / bucketCount)
    );
    expect(stat).toBeLessThan(chiSquareCriticalValue(bucketCount - 1, 0.01));
  });
});

describe('Roulette: pocket uniform over 0..36 (37 buckets, N=37,000)', () => {
  it('chi-square statistic is below the alpha=0.01 critical value', () => {
    const bucketCount = 37;
    const rounds = 37000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const result = calculateRouletteResult({ ...BASE, nonce });
      buckets[result]++;
    }

    const stat = chiSquareGoodnessOfFit(
      buckets,
      new Array(bucketCount).fill(1 / bucketCount)
    );
    expect(stat).toBeLessThan(chiSquareCriticalValue(bucketCount - 1, 0.01));
  });
});

describe('Keno: each of the 40 tiles is hit with equal marginal frequency (N=20,000)', () => {
  it('chi-square statistic on per-tile hit counts is below the alpha=0.01 critical value', () => {
    const bucketCount = KENO_GAME_TILES_COUNT; // 40
    const rounds = 20000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const drawn = calculateKenoHitPositions({ ...BASE, nonce });
      for (const tile of drawn) buckets[tile - 1]++; // tiles are 1-indexed
    }

    // Each of the 40 tiles has marginal P(hit) = 10/40 = 0.25 in any given
    // round's hypergeometric draw; summed across 20,000 rounds each tile's
    // bucket total should be flat.
    const stat = chiSquareGoodnessOfFit(
      buckets,
      new Array(bucketCount).fill(1 / bucketCount)
    );
    expect(stat).toBeLessThan(chiSquareCriticalValue(bucketCount - 1, 0.01));
  });
});

describe('Mines: first mine position is uniform over 0..24 (25 buckets, N=25,000)', () => {
  it('chi-square statistic is below the alpha=0.01 critical value', () => {
    const bucketCount = MINES_GAME_TILES_COUNT; // 25
    const rounds = 25000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const [firstMine] = calculateMinesPositions({ ...BASE, nonce, mines: 1 });
      buckets[firstMine!]++;
    }

    const stat = chiSquareGoodnessOfFit(
      buckets,
      new Array(bucketCount).fill(1 / bucketCount)
    );
    expect(stat).toBeLessThan(chiSquareCriticalValue(bucketCount - 1, 0.01));
  });
});

describe('Chicken: deathPoint distribution matches the min-of-d-subset order statistic', () => {
  // deathPoint = min(d distinct values drawn uniformly without replacement
  // from {1..20}), where d is the difficulty's "slice" size. This is the
  // classic minimum order statistic of a simple random sample:
  //   P(deathPoint = m) = C(N - m, d - 1) / C(N, d),  m = 1 .. N - d + 1
  // For d=1 (easy) this reduces to the uniform distribution the existing
  // chicken.test.ts already checks loosely; for d=3/5/10 (medium/hard/
  // expert) the distribution is skewed toward small m and NOT uniform --
  // asserting flat buckets there would be asserting the wrong model.
  const N = CHICKEN_LANES_COUNT; // 20

  function expectedDeathPointProbabilities(d: number): number[] {
    const maxM = N - d + 1;
    const probs: number[] = [];
    for (let m = 1; m <= maxM; m++) {
      probs.push(nCrLocal(N - m, d - 1) / nCrLocal(N, d));
    }
    return probs;
  }

  const cases: Array<[ChickenDifficulty, number]> = [
    ['easy', 20000],
    ['medium', 20000],
    ['hard', 20000],
    ['expert', 20000],
  ];

  for (const [difficulty, rounds] of cases) {
    it(`${difficulty}: chi-square statistic is below the alpha=0.01 critical value (N=${rounds})`, () => {
      const difficultySlice = CHICKEN_DIFFICULTY_TO_SLICE[difficulty];
      const maxM = N - difficultySlice + 1;
      const buckets = new Array(maxM).fill(0);

      for (let nonce = 0; nonce < rounds; nonce++) {
        const deathPoint = calculateChickenDeathPoint({ ...BASE, nonce, difficultySlice });
        buckets[deathPoint - 1]++; // m=1 -> bucket 0
      }

      const expected = expectedDeathPointProbabilities(difficultySlice);
      const stat = chiSquareGoodnessOfFit(buckets, expected);
      const df = maxM - 1;
      expect(stat).toBeLessThan(chiSquareCriticalValue(df, 0.01));
    });
  }
});

describe('Darts: zone frequencies match DARTS_ZONES probabilities (N=40,000)', () => {
  it('chi-square statistic is below the alpha=0.01 critical value (df=4)', () => {
    const rounds = 40000;
    const buckets = new Array(DARTS_ZONES.length).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { distance } = calculateDartThrow({ ...BASE, nonce });
      const { zoneIndex } = dartsZoneForDistance(distance);
      buckets[zoneIndex]++;
    }

    const expected = DARTS_ZONES.map((zone) => zone.to - zone.from);
    const stat = chiSquareGoodnessOfFit(buckets, expected);
    expect(stat).toBeLessThan(chiSquareCriticalValue(DARTS_ZONES.length - 1, 0.01));
  });
});

describe('HiLo: drawn card id is uniform over 0..51 (52 buckets, N=52,000)', () => {
  it('chi-square statistic is below the alpha=0.01 critical value', () => {
    const bucketCount = deck.length; // 52
    const rounds = 52000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const [card] = calculateHiloResults({ ...BASE, nonce, limit: 1 });
      const id = deck.indexOf(card!);
      buckets[id]++;
    }

    const stat = chiSquareGoodnessOfFit(
      buckets,
      new Array(bucketCount).fill(1 / bucketCount)
    );
    expect(stat).toBeLessThan(chiSquareCriticalValue(bucketCount - 1, 0.01));
  });
});
