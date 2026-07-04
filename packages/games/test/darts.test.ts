import { describe, expect, it } from 'vitest';
import {
  calculateDartThrow,
  DARTS_ZONES,
  dartsZoneForDistance,
  resolveDarts,
} from '../src/darts.js';

const BASE = {
  serverSeed: 'e'.repeat(64),
  clientSeed: 'player-1',
  nonce: 0,
};

describe('resolveDarts', () => {
  it('is deterministic for identical inputs', () => {
    const a = resolveDarts(BASE, {}, 100);
    const b = resolveDarts(BASE, {}, 100);
    expect(a).toEqual(b);
  });

  it('rejects an invalid betAmount', () => {
    expect(() => resolveDarts(BASE, {}, 0)).toThrow();
  });

  it('rejects unknown params (strict schema)', () => {
    expect(() => resolveDarts(BASE, { extra: 1 }, 100)).toThrow();
  });

  it('payout equals betAmount * multiplier', () => {
    const { outcome, multiplier, payout } = resolveDarts(BASE, {}, 100);
    expect(payout).toBeCloseTo(100 * multiplier, 8);
    expect(outcome.rotation).toBeGreaterThanOrEqual(0);
    expect(outcome.rotation).toBeLessThan(1);
  });
});

describe('darts zone table', () => {
  it('Sigma(p * m) == 0.99 exactly', () => {
    // Each zone's width on u (uniform in [0,1)) is its own probability.
    const ev = DARTS_ZONES.reduce(
      (sum, zone) => sum + (zone.to - zone.from) * zone.multiplier,
      0
    );
    expect(Math.abs(ev - 0.99)).toBeLessThan(1e-12);
  });

  it('boundary distances map to the correct zone on each side of the cutpoint', () => {
    const cutpoints = [0.0707, 0.1581, 0.2739, 0.3873];
    const epsilon = 1e-4;

    // Just below 0.0707 -> bullseye, just above -> inner.
    expect(dartsZoneForDistance(cutpoints[0]! - epsilon).zone).toBe('bullseye');
    expect(dartsZoneForDistance(cutpoints[0]! + epsilon).zone).toBe('inner');

    // Just below 0.1581 -> inner, just above -> middle.
    expect(dartsZoneForDistance(cutpoints[1]! - epsilon).zone).toBe('inner');
    expect(dartsZoneForDistance(cutpoints[1]! + epsilon).zone).toBe('middle');

    // Just below 0.2739 -> middle, just above -> outer.
    expect(dartsZoneForDistance(cutpoints[2]! - epsilon).zone).toBe('middle');
    expect(dartsZoneForDistance(cutpoints[2]! + epsilon).zone).toBe('outer');

    // Just below 0.3873 -> outer, just above -> rim.
    expect(dartsZoneForDistance(cutpoints[3]! - epsilon).zone).toBe('outer');
    expect(dartsZoneForDistance(cutpoints[3]! + epsilon).zone).toBe('rim');
  });
});

describe('darts distribution', () => {
  it('u = 4*distance^2 is uniform over 20 buckets in [0,1) across 20k rounds', () => {
    const buckets = new Array(20).fill(0);
    const rounds = 20000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { distance } = calculateDartThrow({ ...BASE, nonce });
      const u = 4 * distance * distance;
      const bucket = Math.min(19, Math.floor(u * 20));
      buckets[bucket]++;
    }

    const expected = rounds / 20;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });

  it('rotation is uniform in [0,1)', () => {
    for (let nonce = 0; nonce < 1000; nonce++) {
      const { rotation } = calculateDartThrow({ ...BASE, nonce });
      expect(rotation).toBeGreaterThanOrEqual(0);
      expect(rotation).toBeLessThan(1);
    }
  });
});

describe('darts MC RTP', () => {
  it('converges near 0.99 over 40k rounds', () => {
    const rounds = 40000;
    const betAmount = 100;
    let totalPayout = 0;
    let totalWagered = 0;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { payout } = resolveDarts({ ...BASE, nonce }, {}, betAmount);
      totalPayout += payout;
      totalWagered += betAmount;
    }

    const observedRTP = totalPayout / totalWagered;
    expect(observedRTP).toBeGreaterThan(0.99 - 0.03);
    expect(observedRTP).toBeLessThan(0.99 + 0.03);
  });
});
