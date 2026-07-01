import { describe, expect, it } from 'vitest';
import { resolvePlinko } from '../src/plinko.js';

const BASE = {
  serverSeed: 'd'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolvePlinko', () => {
  it('is deterministic for identical inputs', () => {
    const params = { rows: 12, risk: 'medium' as const };
    const a = resolvePlinko(BASE, params, 100);
    const b = resolvePlinko(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects rows outside [8,16]', () => {
    expect(() =>
      resolvePlinko(BASE, { rows: 7, risk: 'low' }, 100)
    ).toThrow();
    expect(() =>
      resolvePlinko(BASE, { rows: 17, risk: 'low' }, 100)
    ).toThrow();
  });

  it('rejects an invalid risk', () => {
    expect(() =>
      resolvePlinko(BASE, { rows: 10, risk: 'extreme' }, 100)
    ).toThrow();
  });

  it('always returns payout = betAmount * multiplier, even below 1.0', () => {
    const params = { rows: 8, risk: 'high' as const };
    const { multiplier, payout } = resolvePlinko(BASE, params, 100);
    expect(payout).toBeCloseTo(100 * multiplier);
  });

  it('multiplierIndex is within the bounds of the row count', () => {
    const params = { rows: 16, risk: 'high' as const };
    const { outcome } = resolvePlinko(BASE, params, 100);
    expect(outcome.multiplierIndex).toBeGreaterThanOrEqual(0);
    expect(outcome.multiplierIndex).toBeLessThanOrEqual(16);
  });
});

describe('plinko distribution', () => {
  it('multiplierIndex is roughly binomially distributed for rows=12, medium', () => {
    const rows = 12;
    const buckets = new Array(rows + 1).fill(0);
    const rounds = 30000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolvePlinko(
        { ...BASE, nonce },
        { rows, risk: 'medium' },
        100
      );
      buckets[outcome.multiplierIndex]++;
    }

    // Binomial(12, 0.5): center buckets (5,6,7) should dominate, edges (0,12)
    // should be rare but nonzero-ish over 30k rounds.
    const center = buckets[6];
    const edge = buckets[0];
    expect(center).toBeGreaterThan(edge * 20);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(rounds);
  });
});

describe('plinko RTP sanity', () => {
  it('converges near ~0.99 RTP for rows=12, medium risk (no extra house edge applied)', () => {
    const rounds = 30000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolvePlinko(
        { ...BASE, nonce },
        { rows: 12, risk: 'medium' },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.9);
    expect(observedRTP).toBeLessThan(1.1);
  });

  it('converges near ~0.99 RTP for rows=16, low risk', () => {
    const rounds = 30000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolvePlinko(
        { ...BASE, nonce },
        { rows: 16, risk: 'low' },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.9);
    expect(observedRTP).toBeLessThan(1.1);
  });
});
