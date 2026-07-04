import { describe, expect, it } from 'vitest';
import { nCr } from '../src/combinatorics.js';
import {
  CHICKEN_LANES_COUNT,
  CHICKEN_DIFFICULTY_TO_SLICE,
  calculateChickenDeathPoint,
  chickenMultiplier,
  resolveChicken,
  type ChickenDifficulty,
} from '../src/chicken.js';

const BASE = {
  serverSeed: 'd'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveChicken', () => {
  it('is deterministic for identical inputs', () => {
    const params = { difficulty: 'easy' as const, lanes: 3 };
    const a = resolveChicken(BASE, params, 100);
    const b = resolveChicken(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects lanes exceeding the difficulty max', () => {
    const cases: [ChickenDifficulty, number][] = [
      ['easy', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.easy + 1],
      ['medium', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.medium + 1],
      ['hard', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.hard + 1],
      ['expert', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.expert + 1],
    ];
    for (const [difficulty, lanes] of cases) {
      expect(() => resolveChicken(BASE, { difficulty, lanes }, 100)).toThrow();
    }
  });

  it('accepts lanes exactly at the difficulty max', () => {
    const cases: [ChickenDifficulty, number][] = [
      ['easy', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.easy],
      ['medium', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.medium],
      ['hard', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.hard],
      ['expert', CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE.expert],
    ];
    for (const [difficulty, lanes] of cases) {
      expect(() => resolveChicken(BASE, { difficulty, lanes }, 100)).not.toThrow();
    }
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveChicken(BASE, { difficulty: 'easy', lanes: 1 }, 0)).toThrow();
  });

  it('win iff deathPoint > lanes; payout = win ? bet*multiplier : 0', () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const params = { difficulty: 'medium' as const, lanes: 5 };
      const { outcome, multiplier, payout } = resolveChicken({ ...BASE, nonce }, params, 100);
      expect(outcome.win).toBe(outcome.deathPoint > 5);
      expect(payout).toBe(outcome.win ? 100 * multiplier : 0);
    }
  });
});

describe('chicken multiplier spot checks', () => {
  it('easy/1 lane == 0.99 * 20/19', () => {
    expect(chickenMultiplier('easy', 1)).toBeCloseTo((0.99 * 20) / 19, 10);
  });

  it('expert/10 lanes == 0.99 * C(20,10)', () => {
    expect(chickenMultiplier('expert', 10)).toBeCloseTo(0.99 * nCr(20, 10), 6);
  });
});

describe('chicken death point distribution', () => {
  it('deathPoint is uniform over 1..20 for easy difficulty (20k rounds)', () => {
    const counts = new Array(CHICKEN_LANES_COUNT + 1).fill(0);
    const rounds = 20000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const deathPoint = calculateChickenDeathPoint({
        ...BASE,
        nonce,
        difficultySlice: CHICKEN_DIFFICULTY_TO_SLICE.easy,
      });
      counts[deathPoint]++;
    }

    const expected = rounds / CHICKEN_LANES_COUNT;
    for (let point = 1; point <= CHICKEN_LANES_COUNT; point++) {
      expect(counts[point]).toBeGreaterThan(expected * 0.8);
      expect(counts[point]).toBeLessThan(expected * 1.2);
    }
  });

  it('P(win | easy, lanes=5) is approximately 15/20', () => {
    const rounds = 20000;
    let wins = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolveChicken(
        { ...BASE, nonce },
        { difficulty: 'easy', lanes: 5 },
        100
      );
      if (outcome.win) wins++;
    }

    const observed = wins / rounds;
    const expected = 15 / 20;
    expect(observed).toBeGreaterThan(expected * 0.8);
    expect(observed).toBeLessThan(expected * 1.2);
  });
});

describe('chicken MC RTP', () => {
  it('easy/3-lanes converges near 0.99 over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveChicken(
        { ...BASE, nonce },
        { difficulty: 'easy', lanes: 3 },
        betAmount
      );
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.99 - 0.03);
    expect(observedRTP).toBeLessThan(0.99 + 0.03);
  });
});
