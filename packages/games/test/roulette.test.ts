import { describe, expect, it } from 'vitest';
import {
  RouletteColor,
  rouletteResultToColor,
  resolveRoulette,
  rouletteMultiplier,
  RouletteBetTypeSchema,
  type RouletteBetType,
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
  // Roulette's authentic European single-zero RTP is 36/37 ~= 0.97297 --
  // NOT the platform's usual 0.99 flat target. EUROPEAN_PAYOUTS already
  // bakes in the real single-zero payout scheme (straight 36x on 1/37,
  // red/black 2x on 18/37, etc.), so `rouletteMultiplier` does NOT layer
  // an additional `applyHouseEdge` on top -- the ~2.7% edge comes
  // structurally from the 37th (zero) pocket, on which every bet other
  // than a 0-covering straight loses.
  const EUROPEAN_RTP = 36 / 37;

  it('converges near the authentic European RTP (36/37) over many rounds for a red bet', () => {
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
    expect(observedRTP).toBeGreaterThan(EUROPEAN_RTP - 0.02);
    expect(observedRTP).toBeLessThan(EUROPEAN_RTP + 0.02);
  });
});

describe('rouletteMultiplier', () => {
  it('returns the real European single-zero payout directly (no additional house edge applied)', () => {
    expect(rouletteMultiplier('straight')).toBe(36);
    expect(rouletteMultiplier('split')).toBe(18);
    expect(rouletteMultiplier('street')).toBe(12);
    expect(rouletteMultiplier('corner')).toBe(9);
    expect(rouletteMultiplier('six-line')).toBe(6);
    expect(rouletteMultiplier('column')).toBe(3);
    expect(rouletteMultiplier('dozen')).toBe(3);
    expect(rouletteMultiplier('red')).toBe(2);
    expect(rouletteMultiplier('black')).toBe(2);
    expect(rouletteMultiplier('odd')).toBe(2);
    expect(rouletteMultiplier('even')).toBe(2);
    expect(rouletteMultiplier('high')).toBe(2);
    expect(rouletteMultiplier('low')).toBe(2);
  });

  it('every bet type is exactly analytically fair at the authentic 36/37 European RTP: coverage * multiplier / 37 === 36/37', () => {
    const coverage: Record<RouletteBetType, number> = {
      straight: 1,
      split: 2,
      street: 3,
      corner: 4,
      'six-line': 6,
      column: 12,
      dozen: 12,
      red: 18,
      black: 18,
      odd: 18,
      even: 18,
      high: 18,
      low: 18,
    };

    for (const betType of RouletteBetTypeSchema.options) {
      const ev = (coverage[betType] * rouletteMultiplier(betType)) / 37;
      expect(ev).toBe(36 / 37);
    }
  });
});
