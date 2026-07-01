import { describe, expect, it } from 'vitest';
import { expectedRTP } from '../src/house-edge.js';
import {
  RouletteColor,
  rouletteResultToColor,
  resolveRoulette,
} from '../src/roulette.js';

const BASE = {
  serverSeed: 'c'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

const REAL_RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

describe('rouletteResultToColor', () => {
  it('matches the real European wheel red/black/green table for 0..36', () => {
    for (let n = 0; n <= 36; n++) {
      const color = rouletteResultToColor(n as any);
      if (n === 0) {
        expect(color).toBe(RouletteColor.Green);
      } else if (REAL_RED.has(n)) {
        expect(color).toBe(RouletteColor.Red);
      } else {
        expect(color).toBe(RouletteColor.Black);
      }
    }
  });
});

describe('resolveRoulette', () => {
  it('is deterministic for identical inputs', () => {
    const params = { betType: 'red' as const, numbers: [] };
    const a = resolveRoulette(BASE, params, 100);
    const b = resolveRoulette(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects a straight bet with the wrong number of numbers', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'straight', numbers: [1, 2] }, 100)
    ).toThrow();
  });

  it('rejects a split bet with non-adjacent numbers', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'split', numbers: [1, 36] }, 100)
    ).toThrow();
  });

  it('accepts a valid split bet (horizontally adjacent)', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'split', numbers: [1, 2] }, 100)
    ).not.toThrow();
  });

  it('accepts a valid street bet', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'street', numbers: [1, 2, 3] }, 100)
    ).not.toThrow();
  });

  it('accepts a valid corner bet', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { betType: 'corner', numbers: [1, 2, 4, 5] },
        100
      )
    ).not.toThrow();
  });

  it('accepts a valid six-line bet', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { betType: 'six-line', numbers: [1, 2, 3, 4, 5, 6] },
        100
      )
    ).not.toThrow();
  });

  it('requires a zone for column/dozen bets', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'dozen', numbers: [] }, 100)
    ).toThrow();
    expect(() =>
      resolveRoulette(BASE, { betType: 'dozen', numbers: [], zone: 1 }, 100)
    ).not.toThrow();
  });

  it('rejects numbers for outside/simple bets like red/odd/high', () => {
    expect(() =>
      resolveRoulette(BASE, { betType: 'red', numbers: [1] }, 100)
    ).toThrow();
  });

  it('computes win/payout consistently for a straight bet', () => {
    const { outcome, multiplier, payout } = resolveRoulette(
      BASE,
      { betType: 'straight', numbers: [17] },
      100
    );
    const expectedWin = outcome.result === 17;
    expect(outcome.win).toBe(expectedWin);
    expect(payout).toBe(expectedWin ? 100 * multiplier : 0);
  });
});

describe('roulette distribution', () => {
  it('result is roughly uniform across 37 buckets', () => {
    const buckets = new Array(37).fill(0);
    const rounds = 37000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolveRoulette(
        { ...BASE, nonce },
        { betType: 'red', numbers: [] },
        100
      );
      buckets[outcome.result]++;
    }

    const expected = rounds / 37;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.7);
      expect(count).toBeLessThan(expected * 1.3);
    }
  });
});

describe('roulette RTP sanity', () => {
  it('converges near expectedRTP(0.01) over many rounds for a red bet', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveRoulette(
        { ...BASE, nonce },
        { betType: 'red', numbers: [] },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    const expected = expectedRTP(0.01) / 100;
    expect(observedRTP).toBeGreaterThan(expected - 0.03);
    expect(observedRTP).toBeLessThan(expected + 0.03);
  });
});
