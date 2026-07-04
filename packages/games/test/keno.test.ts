import { describe, expect, it } from 'vitest';
import { nCr } from '../src/combinatorics.js';
import {
  KENO_GAME_TILES_COUNT,
  calculateKenoHitPositions,
  kenoMultiplierTable,
  kenoMultiplier,
  resolveKeno,
  type KenoRisk,
} from '../src/keno.js';

const BASE = {
  serverSeed: 'c'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

const RISKS: KenoRisk[] = ['low', 'classic', 'medium', 'high'];
const RISK_KMIN_FRAC: Record<KenoRisk, number> = {
  low: 0.4,
  classic: 0.5,
  medium: 0.6,
  high: 0.7,
};

function kenoHitProbability(N: number, k: number): number {
  return (nCr(N, k) * nCr(40 - N, 10 - k)) / nCr(40, 10);
}

describe('resolveKeno', () => {
  it('is deterministic for identical inputs', () => {
    const params = { risk: 'classic' as const, picks: [1, 2, 3] };
    const a = resolveKeno(BASE, params, 100);
    const b = resolveKeno(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects duplicate picks', () => {
    expect(() =>
      resolveKeno(BASE, { risk: 'classic', picks: [1, 1, 2] }, 100)
    ).toThrow();
  });

  it('rejects more than 10 picks', () => {
    expect(() =>
      resolveKeno(BASE, { risk: 'classic', picks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, 100)
    ).toThrow();
  });

  it('rejects pick 0', () => {
    expect(() => resolveKeno(BASE, { risk: 'classic', picks: [0] }, 100)).toThrow();
  });

  it('rejects pick 41', () => {
    expect(() => resolveKeno(BASE, { risk: 'classic', picks: [41] }, 100)).toThrow();
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveKeno(BASE, { risk: 'classic', picks: [1] }, 0)).toThrow();
    expect(() => resolveKeno(BASE, { risk: 'classic', picks: [1] }, -5)).toThrow();
  });

  it('draws always 10 unique, sorted-ascending tiles', () => {
    for (let nonce = 0; nonce < 500; nonce++) {
      const drawn = calculateKenoHitPositions({ ...BASE, nonce });
      expect(drawn).toHaveLength(10);
      expect(new Set(drawn).size).toBe(10);
      for (const tile of drawn) {
        expect(tile).toBeGreaterThanOrEqual(1);
        expect(tile).toBeLessThanOrEqual(40);
      }
      const sorted = [...drawn].sort((a, b) => a - b);
      expect(drawn).toEqual(sorted);
    }
  });

  it('payout equals betAmount * multiplier (graded, including 0 below kmin)', () => {
    const params = { risk: 'classic' as const, picks: [1, 2, 3] };
    const { outcome, multiplier, payout } = resolveKeno(BASE, params, 100);
    expect(payout).toBeCloseTo(100 * multiplier, 8);
    if (outcome.hitCount < 2) {
      expect(multiplier).toBe(0);
    }
  });
});

describe('keno tile draw uniformity', () => {
  it('each of the 40 tiles appears ~25% of the time across 20k rounds', () => {
    const counts = new Array(KENO_GAME_TILES_COUNT + 1).fill(0);
    const rounds = 20000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const drawn = calculateKenoHitPositions({ ...BASE, nonce });
      for (const tile of drawn) counts[tile]++;
    }

    const expected = rounds * (10 / 40);
    for (let tile = 1; tile <= KENO_GAME_TILES_COUNT; tile++) {
      expect(counts[tile]).toBeGreaterThan(expected * 0.8);
      expect(counts[tile]).toBeLessThan(expected * 1.2);
    }
  });
});

describe('keno analytic paytable', () => {
  it('Sigma(P(k) * m_k) is within 1e-9 of 0.99 for every (risk, N=1..10)', () => {
    for (const risk of RISKS) {
      for (let N = 1; N <= 10; N++) {
        const table = kenoMultiplierTable(risk, N);
        let ev = 0;
        for (let k = 0; k <= N; k++) {
          ev += kenoHitProbability(N, k) * table[k]!;
        }
        expect(Math.abs(ev - 0.99)).toBeLessThan(1e-9);
      }
    }
  });

  it('m_k is non-decreasing for k >= kmin', () => {
    for (const risk of RISKS) {
      for (let N = 1; N <= 10; N++) {
        const table = kenoMultiplierTable(risk, N);
        const kmin = Math.max(1, Math.ceil(N * RISK_KMIN_FRAC[risk]));
        for (let k = kmin; k < N; k++) {
          expect(table[k]!).toBeLessThanOrEqual(table[k + 1]!);
        }
      }
    }
  });

  it('the computed classic/3-picks table matches the pinned reference values', () => {
    const table = kenoMultiplierTable('classic', 3);
    expect(table[0]).toBeCloseTo(0, 8);
    expect(table[1]).toBeCloseTo(0, 8);
    expect(table[2]).toBeCloseTo(4.2731513513668995, 8);
    expect(table[3]).toBeCloseTo(33.43704729712237, 8);
  });
});

describe('keno MC RTP', () => {
  it('classic/3-picks converges near 0.99 over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveKeno(
        { ...BASE, nonce },
        { risk: 'classic', picks: [1, 2, 3] },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.99 - 0.03);
    expect(observedRTP).toBeLessThan(0.99 + 0.03);
  });

  it('kenoMultiplier matches kenoMultiplierTable lookups', () => {
    for (const risk of RISKS) {
      const table = kenoMultiplierTable(risk, 5);
      for (let k = 0; k <= 5; k++) {
        expect(kenoMultiplier(risk, 5, k)).toBe(table[k]);
      }
    }
  });
});
