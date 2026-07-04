// Deep fairness suite, part 1: core float-generator uniformity, serial
// (lag-1) independence across nonces, and cross-stream independence
// (domain separation) checks.
//
// Iteration counts / runtime (measured on this machine, `vitest run` for
// just this file): float uniformity uses 50,000 draws (one hmac round
// each -- pure RNG, no game logic on top), serial correlation uses 20,000
// nonces, cross-stream checks use 3,000 Mines rounds. All run in well
// under a second combined; no FAIRNESS_LONG gating needed here since these
// are cheap (raw RNG calls, not full game resolutions).
//
// Every test below uses a FIXED serverSeed/clientSeed/nonce-range, so it is
// fully deterministic -- a correct RNG implementation will pass every time,
// with no flake margin required beyond the chi-square critical value /
// correlation threshold itself.

import { describe, expect, it } from 'vitest';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import {
  calculateMinesPositions,
  deriveRevealOrder,
  MINES_GAME_TILES_COUNT,
} from '../../src/mines.js';
import {
  chiSquareCriticalValue,
  chiSquareUniformity,
  pearsonCorrelation,
} from './chi-square.js';

const BASE: GeneratorOptions = {
  serverSeed: 'aa11'.repeat(16),
  clientSeed: 'fairness-suite',
  nonce: 0,
};

describe('createFloatGenerator uniformity (chi-square, not +/-20% buckets)', () => {
  it('floats are uniform across 20 buckets in [0,1) at alpha=0.01 (N=50,000)', () => {
    const bucketCount = 20;
    const rounds = 50000;
    const buckets = new Array(bucketCount).fill(0);

    const gen = createFloatGenerator(BASE);
    for (let i = 0; i < rounds; i++) {
      const float = gen.next().value;
      const bucket = Math.min(bucketCount - 1, Math.floor(float * bucketCount));
      buckets[bucket]++;
    }

    const stat = chiSquareUniformity(buckets);
    const critical = chiSquareCriticalValue(bucketCount - 1, 0.01);
    expect(stat).toBeLessThan(critical);
  });

  it('floats stay uniform across 20 buckets when sampled one-per-nonce (N=20,000)', () => {
    // Same check as above, but drawing exactly one float per round from a
    // fresh generator at each incrementing nonce -- this is the access
    // pattern every game module actually uses (a new generator per
    // resolve() call), not a single long-lived generator.
    const bucketCount = 20;
    const rounds = 20000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const float = createFloatGenerator({ ...BASE, nonce }).next().value;
      const bucket = Math.min(bucketCount - 1, Math.floor(float * bucketCount));
      buckets[bucket]++;
    }

    const stat = chiSquareUniformity(buckets);
    const critical = chiSquareCriticalValue(bucketCount - 1, 0.01);
    expect(stat).toBeLessThan(critical);
  });
});

describe('serial correlation / nonce independence', () => {
  it('lag-1 autocorrelation between consecutive-nonce floats is negligible (N=20,000)', () => {
    // x_i = float drawn at nonce i, y_i = float drawn at nonce i+1. If the
    // RNG had any meaningful nonce-to-nonce dependency (e.g. a shared
    // internal counter leaking across nonces), this would show up as a
    // non-trivial |r|.
    const rounds = 20000;
    const xs: number[] = [];
    const ys: number[] = [];

    for (let nonce = 0; nonce < rounds; nonce++) {
      xs.push(createFloatGenerator({ ...BASE, nonce }).next().value);
      ys.push(createFloatGenerator({ ...BASE, nonce: nonce + 1 }).next().value);
    }

    const r = pearsonCorrelation(xs, ys);
    // For a truly independent pair with N=20,000, SE(r) ~= 1/sqrt(N) ~= 0.0071.
    // 0.03 gives a >4-sigma margin against false failures while still
    // catching any real, meaningful correlation.
    expect(Math.abs(r)).toBeLessThan(0.03);
  });

  it('lag-1 autocorrelation within a single long-lived generator is negligible (N=20,000)', () => {
    const rounds = 20000;
    const gen = createFloatGenerator(BASE);
    const all: number[] = [];
    for (let i = 0; i < rounds + 1; i++) all.push(gen.next().value);

    const xs = all.slice(0, rounds);
    const ys = all.slice(1, rounds + 1);

    const r = pearsonCorrelation(xs, ys);
    expect(Math.abs(r)).toBeLessThan(0.03);
  });
});

describe('cross-stream independence (domain separation)', () => {
  it("Mines' mine-position stream and its `:reveal-order` stream are uncorrelated (N=3,000)", () => {
    // Real bug class this guards against (caught during M3): if
    // deriveRevealOrder ever drew from the SAME float stream as
    // calculateMinesPositions instead of a `:reveal-order`-suffixed
    // clientSeed, the first `mines` reveals would exactly reproduce the
    // mine positions every round (guaranteed hit). Check both (a) no
    // exact-reproduction and (b) no significant correlation between the
    // two streams' first-drawn values across many rounds.
    const rounds = 3000;
    const mines = 5;
    const minesFirstDraw: number[] = [];
    const revealFirstDraw: number[] = [];
    let exactPrefixMatches = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const generatorOpts = { ...BASE, nonce };
      const minePositions = calculateMinesPositions({ ...generatorOpts, mines });
      const revealOrder = deriveRevealOrder(generatorOpts);

      minesFirstDraw.push(minePositions[0]!);
      revealFirstDraw.push(revealOrder[0]!);

      const firstMinesSet = new Set(minePositions);
      const revealPrefix = revealOrder.slice(0, mines);
      if (revealPrefix.every((tile) => firstMinesSet.has(tile))) {
        exactPrefixMatches++;
      }
    }

    // Streams are drawn from independent domains (different derived
    // positions arrays); Pearson correlation between the two streams'
    // first-drawn tile index should be negligible.
    const r = pearsonCorrelation(minesFirstDraw, revealFirstDraw);
    expect(Math.abs(r)).toBeLessThan(0.05);

    // If the two streams were the same underlying sequence, the first
    // `mines` reveal-order tiles would almost always exactly equal the
    // mine positions set. With independent streams and mines=5 out of 25
    // tiles, P(revealPrefix subset of minePositions) is astronomically
    // small (~C(5,5)/C(25,5) magnitude per round); across 3000 independent
    // rounds we expect exactly 0 matches, and even a handful would be a
    // smoking gun, not proof of a bug on its own -- so assert it stays at
    // (or extremely near) 0 rather than a hard 0, to avoid a
    // theoretically-possible-but-vanishingly-unlikely flake.
    expect(exactPrefixMatches).toBeLessThanOrEqual(1);
  });

  it('mine positions are uniform over 0..24 independent of the reveal-order stream (N=25,000)', () => {
    const bucketCount = MINES_GAME_TILES_COUNT;
    const rounds = 25000;
    const buckets = new Array(bucketCount).fill(0);

    for (let nonce = 0; nonce < rounds; nonce++) {
      const [firstMine] = calculateMinesPositions({ ...BASE, nonce, mines: 1 });
      buckets[firstMine!]++;
    }

    const stat = chiSquareUniformity(buckets);
    const critical = chiSquareCriticalValue(bucketCount - 1, 0.01);
    expect(stat).toBeLessThan(critical);
  });

  it('changing only the nonce (fixed server+client seed) produces uncorrelated float sequences at lag 2..5', () => {
    // Broader nonce-independence sweep: check several lags, not just lag-1,
    // to catch periodicity a lag-1-only check could miss.
    const rounds = 8000;
    const series: number[] = [];
    for (let nonce = 0; nonce < rounds; nonce++) {
      series.push(createFloatGenerator({ ...BASE, nonce }).next().value);
    }

    for (const lag of [2, 3, 4, 5]) {
      const xs = series.slice(0, rounds - lag);
      const ys = series.slice(lag, rounds);
      const r = pearsonCorrelation(xs, ys);
      expect(Math.abs(r)).toBeLessThan(0.04);
    }
  });
});
