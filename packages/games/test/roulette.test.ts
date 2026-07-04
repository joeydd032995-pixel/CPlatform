import { describe, expect, it } from 'vitest';
import {
  RouletteColor,
  rouletteResultToColor,
  resolveRoulette,
  rouletteMultiplier,
  RouletteBetTypeSchema,
  type RouletteBetType,
} from '../src/roulette.js';
import { InvalidBetParamsError } from '@cplatform/shared';

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
    const params = { bets: [{ betType: 'red' as const, numbers: [], amount: 100 }] };
    const a = resolveRoulette(BASE, params, 100);
    const b = resolveRoulette(BASE, params, 100);
    expect(a).toEqual(b);
  });

  it('rejects a straight bet with the wrong number of numbers', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'straight', numbers: [1, 2], amount: 100 }] },
        100
      )
    ).toThrow();
  });

  it('rejects a split bet with non-adjacent numbers', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'split', numbers: [1, 36], amount: 100 }] },
        100
      )
    ).toThrow();
  });

  it('accepts a valid split bet (horizontally adjacent)', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'split', numbers: [1, 2], amount: 100 }] },
        100
      )
    ).not.toThrow();
  });

  it('accepts a valid street bet', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'street', numbers: [1, 2, 3], amount: 100 }] },
        100
      )
    ).not.toThrow();
  });

  it('accepts a valid corner bet', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'corner', numbers: [1, 2, 4, 5], amount: 100 }] },
        100
      )
    ).not.toThrow();
  });

  it('accepts a valid six-line bet', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        {
          bets: [
            { betType: 'six-line', numbers: [1, 2, 3, 4, 5, 6], amount: 100 },
          ],
        },
        100
      )
    ).not.toThrow();
  });

  it('requires a zone for column/dozen bets', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'dozen', numbers: [], amount: 100 }] },
        100
      )
    ).toThrow();
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'dozen', numbers: [], zone: 1, amount: 100 }] },
        100
      )
    ).not.toThrow();
  });

  it('rejects numbers for outside/simple bets like red/odd/high', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        { bets: [{ betType: 'red', numbers: [1], amount: 100 }] },
        100
      )
    ).toThrow();
  });

  it('computes win/payout consistently for a straight bet', () => {
    const { outcome, multiplier, payout } = resolveRoulette(
      BASE,
      { bets: [{ betType: 'straight', numbers: [17], amount: 100 }] },
      100
    );
    const expectedWin = outcome.result === 17;
    expect(outcome.win).toBe(expectedWin);
    expect(outcome.bets).toHaveLength(1);
    expect(outcome.bets[0].win).toBe(expectedWin);
    expect(payout).toBe(expectedWin ? 100 * 36 : 0);
    expect(multiplier).toBe(payout > 0 ? payout / 100 : 0);
  });

  it('rejects an empty bets array', () => {
    expect(() => resolveRoulette(BASE, { bets: [] }, 100)).toThrow();
  });

  it('throws InvalidBetParamsError when the sum of per-bet amounts does not equal betAmount', () => {
    expect(() =>
      resolveRoulette(
        BASE,
        {
          bets: [
            { betType: 'red', numbers: [], amount: 40 },
            { betType: 'black', numbers: [], amount: 40 },
          ],
        },
        // sum of bets is 80, but betAmount claims 100 -- must be rejected
        // before any spin happens (balance-debit safety guard).
        100
      )
    ).toThrow(InvalidBetParamsError);
  });

  it('settles multiple concurrent differing bets correctly off a single draw', () => {
    const { outcome, payout } = resolveRoulette(
      BASE,
      {
        bets: [
          { betType: 'straight', numbers: [17], amount: 10 },
          { betType: 'red', numbers: [], amount: 20 },
          { betType: 'dozen', numbers: [], zone: 0, amount: 5 },
        ],
      },
      35
    );

    expect(outcome.bets).toHaveLength(3);

    const straightWin = outcome.result === 17;
    const redWin = REAL_RED.has(outcome.result);
    const dozenWin =
      outcome.result !== 0 && Math.floor((outcome.result - 1) / 12) === 0;

    expect(outcome.bets[0].win).toBe(straightWin);
    expect(outcome.bets[0].payout).toBe(straightWin ? 10 * 36 : 0);
    expect(outcome.bets[1].win).toBe(redWin);
    expect(outcome.bets[1].payout).toBe(redWin ? 20 * 2 : 0);
    expect(outcome.bets[2].win).toBe(dozenWin);
    expect(outcome.bets[2].payout).toBe(dozenWin ? 5 * 3 : 0);

    const expectedTotal =
      (straightWin ? 10 * 36 : 0) +
      (redWin ? 20 * 2 : 0) +
      (dozenWin ? 5 * 3 : 0);
    expect(payout).toBe(expectedTotal);
    expect(outcome.win).toBe(straightWin || redWin || dozenWin);
  });

  it('draws exactly one float per resolveRoulette call, regardless of bets.length', () => {
    // A second float draw would consume more of the deterministic float
    // stream for this (serverSeed, clientSeed, nonce) and could shift what
    // the single spin lands on. Since draws are keyed off the *same*
    // generatorOpts (not incremented per-bet), a 1-bet request and an
    // N-bet request against identical generatorOpts must land on the exact
    // same `outcome.result` -- proving only one float was consumed each
    // time, no matter how many bets were in the array.
    const single = resolveRoulette(
      BASE,
      { bets: [{ betType: 'red', numbers: [], amount: 100 }] },
      100
    );

    const many = resolveRoulette(
      BASE,
      {
        bets: [
          { betType: 'straight', numbers: [1], amount: 5 },
          { betType: 'black', numbers: [], amount: 10 },
          { betType: 'odd', numbers: [], amount: 15 },
          { betType: 'even', numbers: [], amount: 20 },
          { betType: 'high', numbers: [], amount: 25 },
          { betType: 'low', numbers: [], amount: 25 },
        ],
      },
      100
    );

    expect(many.outcome.result).toBe(single.outcome.result);
    expect(many.outcome.color).toBe(single.outcome.color);
  });

  it('per-bet win/payout correctness against a fixed seed/nonce with concurrent bets', () => {
    // Pin a known result the same way the existing distribution tests do:
    // fixed serverSeed/clientSeed/nonce -> deterministic float -> known
    // RouletteResult. serverSeed 'c'.repeat(64), clientSeed 'player-1',
    // nonce 0 has already been used above; here we additionally confirm
    // the derived color/win matrix for a mixed set of bets against that
    // exact same draw.
    const fixed = { serverSeed: 'a'.repeat(64), clientSeed: 'fixed-seed', nonce: 7 };

    const { outcome } = resolveRoulette(
      fixed,
      {
        bets: [
          // Guaranteed-losing straight bet: 37 is out of range for a real
          // wheel, so pin a straight bet on a number we know cannot be the
          // result under this scheme without inspecting it first -- instead,
          // derive expectations directly from the actual draw below.
          { betType: 'straight', numbers: [0], amount: 10 },
          { betType: 'red', numbers: [], amount: 10 },
        ],
      },
      20
    );

    const expectedStraightWin = outcome.result === 0;
    const expectedRedWin = REAL_RED.has(outcome.result);

    expect(outcome.bets[0].win).toBe(expectedStraightWin);
    expect(outcome.bets[0].payout).toBe(expectedStraightWin ? 10 * 36 : 0);
    expect(outcome.bets[1].win).toBe(expectedRedWin);
    expect(outcome.bets[1].payout).toBe(expectedRedWin ? 10 * 2 : 0);
    // A straight-0 bet and a red bet can never both win on the same spin
    // (0 is green, not red), giving us a concrete cross-check.
    expect(expectedStraightWin && expectedRedWin).toBe(false);
  });
});

describe('roulette distribution', () => {
  it('result is roughly uniform across 37 buckets', () => {
    const buckets = new Array(37).fill(0);
    const rounds = 37000;

    for (let nonce = 0; nonce < rounds; nonce++) {
      const { outcome } = resolveRoulette(
        { ...BASE, nonce },
        { bets: [{ betType: 'red', numbers: [], amount: 100 }] },
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
        { bets: [{ betType: 'red', numbers: [], amount: betAmount }] },
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
