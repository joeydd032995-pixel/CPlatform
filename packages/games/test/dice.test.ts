import { describe, expect, it } from 'vitest';
import { expectedRTP } from '../src/house-edge.js';
import { resolveDice } from '../src/dice.js';

const BASE = {
  serverSeed: 'b'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveDice', () => {
  it('is deterministic for identical inputs', () => {
    const params = { target: 50, direction: 'under' as const };
    const a = resolveDice(BASE, params, 100);
    const b = resolveDice(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects target outside (0,100)', () => {
    expect(() =>
      resolveDice(BASE, { target: 0, direction: 'under' }, 100)
    ).toThrow();
    expect(() =>
      resolveDice(BASE, { target: 100, direction: 'under' }, 100)
    ).toThrow();
    expect(() =>
      resolveDice(BASE, { target: -1, direction: 'over' }, 100)
    ).toThrow();
  });

  it('rejects an invalid direction', () => {
    expect(() =>
      resolveDice(BASE, { target: 50, direction: 'sideways' }, 100)
    ).toThrow();
  });

  it('computes win/payout consistently with roll vs target/direction', () => {
    const params = { target: 50, direction: 'under' as const };
    const { outcome, multiplier, payout } = resolveDice(BASE, params, 100);
    const expectedWin = outcome.roll < 50;
    expect(outcome.win).toBe(expectedWin);
    expect(payout).toBe(expectedWin ? 100 * multiplier : 0);
  });
});

describe('dice distribution', () => {
  it('roll is roughly uniform across 20 buckets over 0-100', () => {
    const buckets = new Array(20).fill(0);
    const rounds = 20000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolveDice(
        { ...BASE, nonce },
        { target: 50, direction: 'under' },
        100
      );
      const bucket = Math.min(19, Math.floor(outcome.roll / 5));
      buckets[bucket]++;
    }

    const expected = rounds / 20;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

describe('dice RTP sanity', () => {
  it('converges near expectedRTP(0.01) over many rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveDice(
        { ...BASE, nonce },
        { target: 50, direction: 'under' },
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
