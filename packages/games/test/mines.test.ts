import { describe, expect, it } from 'vitest';
import { nCr } from '../src/combinatorics.js';
import { expectedRTP } from '../src/house-edge.js';
import { resolveMines, minesMultiplier } from '../src/mines.js';

const BASE = {
  serverSeed: 'a'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveMines', () => {
  it('is deterministic for identical inputs', () => {
    const params = { mines: 5, picks: 3 };
    const a = resolveMines(BASE, params, 100);
    const b = resolveMines(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects picks exceeding safe tile count', () => {
    expect(() => resolveMines(BASE, { mines: 24, picks: 5 }, 100)).toThrow();
  });

  it('rejects mines outside [1,24]', () => {
    expect(() => resolveMines(BASE, { mines: 0, picks: 1 }, 100)).toThrow();
    expect(() => resolveMines(BASE, { mines: 25, picks: 1 }, 100)).toThrow();
  });

  it('returns multiplier 1 and full payout for picks=0', () => {
    const { multiplier, payout, outcome } = resolveMines(
      BASE,
      { mines: 5, picks: 0 },
      100
    );
    expect(multiplier).toBe(1);
    expect(payout).toBe(100);
    expect((outcome as any).revealOrder).toEqual([]);
  });

  it('pays 0 when a mine is hit, betAmount*multiplier otherwise', () => {
    const params = { mines: 5, picks: 3 };
    const { outcome, multiplier, payout } = resolveMines(BASE, params, 100);
    const hitMine = (outcome as any).hitMine as boolean;
    if (hitMine) {
      expect(payout).toBe(0);
    } else {
      expect(payout).toBeCloseTo(100 * multiplier);
    }
  });

  it('sanity check: nCr(25,3)/nCr(22,3) is close to 1.4935', () => {
    const fairMultiplier = nCr(25, 3) / nCr(22, 3);
    expect(fairMultiplier).toBeCloseTo(1.4935, 3);
  });

  it('minesMultiplier applies house edge relative to fair multiplier', () => {
    const fair = nCr(25, 3) / nCr(22, 3);
    const withEdge = minesMultiplier(3, 3);
    expect(withEdge).toBeCloseTo(fair * 0.99, 6);
  });
});

describe('mines distribution', () => {
  it('first revealed tile position is roughly uniform across 25 buckets', () => {
    const buckets = new Array(25).fill(0);
    const rounds = 25000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolveMines(
        { ...BASE, nonce },
        { mines: 3, picks: 1 },
        100
      );
      const firstTile = (outcome as any).revealOrder[0] as number;
      buckets[firstTile]++;
    }

    const expected = rounds / 25;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

describe('mines RTP sanity', () => {
  it('converges near expectedRTP(0.01) over many rounds', () => {
    const rounds = 30000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveMines(
        { ...BASE, nonce },
        { mines: 3, picks: 3 },
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
