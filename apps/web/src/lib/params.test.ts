import { describe, expect, it } from 'vitest';
import {
  MinesParamsSchema,
  PlinkoParamsSchema,
  DiceParamsSchema,
  RouletteParamsSchema,
  BetAmountSchema,
} from './params';

describe('BetAmountSchema', () => {
  it('rejects zero, negative, and non-finite amounts', () => {
    expect(BetAmountSchema.safeParse(0).success).toBe(false);
    expect(BetAmountSchema.safeParse(-5).success).toBe(false);
    expect(BetAmountSchema.safeParse(Number.NaN).success).toBe(false);
    expect(BetAmountSchema.safeParse(Infinity).success).toBe(false);
  });

  it('accepts a positive finite amount', () => {
    expect(BetAmountSchema.safeParse(10).success).toBe(true);
  });
});

describe('MinesParamsSchema', () => {
  it('rejects mines below the minimum (0)', () => {
    expect(MinesParamsSchema.safeParse({ mines: 0, picks: 0 }).success).toBe(false);
  });

  it('rejects mines above the maximum (25)', () => {
    expect(MinesParamsSchema.safeParse({ mines: 25, picks: 0 }).success).toBe(false);
  });

  it('accepts the boundary mines values 1 and 24', () => {
    expect(MinesParamsSchema.safeParse({ mines: 1, picks: 0 }).success).toBe(true);
    expect(MinesParamsSchema.safeParse({ mines: 24, picks: 1 }).success).toBe(true);
  });

  it('rejects picks that overflow the safe tile count', () => {
    // 3 mines -> 22 safe tiles; 23 picks overflows.
    expect(MinesParamsSchema.safeParse({ mines: 3, picks: 23 }).success).toBe(false);
    expect(MinesParamsSchema.safeParse({ mines: 3, picks: 22 }).success).toBe(true);
  });
});

describe('PlinkoParamsSchema', () => {
  it('rejects rows below 8 or above 16', () => {
    expect(PlinkoParamsSchema.safeParse({ rows: 7, risk: 'low' }).success).toBe(false);
    expect(PlinkoParamsSchema.safeParse({ rows: 17, risk: 'low' }).success).toBe(false);
  });

  it('accepts boundary rows 8 and 16', () => {
    expect(PlinkoParamsSchema.safeParse({ rows: 8, risk: 'low' }).success).toBe(true);
    expect(PlinkoParamsSchema.safeParse({ rows: 16, risk: 'high' }).success).toBe(true);
  });

  it('rejects an invalid risk value', () => {
    expect(PlinkoParamsSchema.safeParse({ rows: 10, risk: 'extreme' }).success).toBe(false);
  });
});

describe('DiceParamsSchema', () => {
  it('rejects target at the boundaries 0 and 100', () => {
    expect(DiceParamsSchema.safeParse({ target: 0, direction: 'over' }).success).toBe(false);
    expect(DiceParamsSchema.safeParse({ target: 100, direction: 'over' }).success).toBe(false);
  });

  it('accepts targets strictly between 0 and 100', () => {
    expect(DiceParamsSchema.safeParse({ target: 0.01, direction: 'over' }).success).toBe(true);
    expect(DiceParamsSchema.safeParse({ target: 99.99, direction: 'under' }).success).toBe(true);
  });

  it('rejects an invalid direction', () => {
    expect(DiceParamsSchema.safeParse({ target: 50, direction: 'sideways' }).success).toBe(false);
  });
});

describe('RouletteParamsSchema', () => {
  // Multi-chip betting: params is now `{ bets: [...] }`, an array of
  // individually-staked bet legs (real casino felt semantics -- several
  // simultaneous bets, one spin settles all of them).
  it('accepts a valid straight bet', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'straight', numbers: [17], amount: 5 }],
      }).success
    ).toBe(true);
  });

  it('rejects a straight bet with the wrong number count', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'straight', numbers: [1, 2], amount: 5 }],
      }).success
    ).toBe(false);
  });

  it('rejects a split bet with non-adjacent numbers', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'split', numbers: [1, 36], amount: 5 }],
      }).success
    ).toBe(false);
  });

  it('accepts a split bet with adjacent felt numbers', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'split', numbers: [1, 2], amount: 5 }],
      }).success
    ).toBe(true);
  });

  it('requires a zone for column/dozen bets and rejects numbers', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'column', numbers: [], amount: 5 }],
      }).success
    ).toBe(false);
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'column', numbers: [], zone: 0, amount: 5 }],
      }).success
    ).toBe(true);
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'dozen', numbers: [1], zone: 0, amount: 5 }],
      }).success
    ).toBe(false);
  });

  it('rejects numbers on simple outside bets', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'red', numbers: [1], amount: 5 }],
      }).success
    ).toBe(false);
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'red', numbers: [], amount: 5 }],
      }).success
    ).toBe(true);
  });

  it('rejects an empty bets array and requires a positive per-bet amount', () => {
    expect(RouletteParamsSchema.safeParse({ bets: [] }).success).toBe(false);
    expect(
      RouletteParamsSchema.safeParse({
        bets: [{ betType: 'red', numbers: [], amount: 0 }],
      }).success
    ).toBe(false);
  });

  it('accepts multiple concurrent bets in one request', () => {
    expect(
      RouletteParamsSchema.safeParse({
        bets: [
          { betType: 'straight', numbers: [17], amount: 2 },
          { betType: 'red', numbers: [], amount: 5 },
        ],
      }).success
    ).toBe(true);
  });
});
