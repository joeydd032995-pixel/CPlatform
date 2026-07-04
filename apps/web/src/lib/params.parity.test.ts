// node-env test (matches src/**/*.test.ts in vitest.config.ts's
// environmentMatchGlobs): imports the REAL schemas from '@cplatform/games'
// at runtime -- fine here since vitest/node has access to Node's `crypto`
// (unlike a browser bundle produced by `next build`). Runs a shared fixture
// table of valid+invalid inputs through both the local and real schemas and
// asserts identical accept/reject per fixture, to catch drift between this
// app's re-declared schemas and the server's source of truth.
import { describe, expect, it } from 'vitest';
import * as real from '@cplatform/games';
import * as local from './params';

describe('mines params parity', () => {
  const fixtures: unknown[] = [
    { mines: 3, picks: 1 },
    { mines: 0, picks: 0 },
    { mines: 25, picks: 0 },
    { mines: 24, picks: 1 },
    { mines: 3, picks: 22 },
    { mines: 3, picks: 23 },
    { mines: 1.5, picks: 1 },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.MinesParamsSchema.safeParse(fixture).success;
    const localResult = local.MinesParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('plinko params parity', () => {
  const fixtures: unknown[] = [
    { rows: 12, risk: 'medium' },
    { rows: 7, risk: 'low' },
    { rows: 17, risk: 'low' },
    { rows: 8, risk: 'high' },
    { rows: 16, risk: 'low' },
    { rows: 10, risk: 'extreme' },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.PlinkoParamsSchema.safeParse(fixture).success;
    const localResult = local.PlinkoParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('dice params parity', () => {
  const fixtures: unknown[] = [
    { target: 50, direction: 'over' },
    { target: 0, direction: 'over' },
    { target: 100, direction: 'under' },
    { target: 0.01, direction: 'over' },
    { target: 99.99, direction: 'under' },
    { target: 50, direction: 'sideways' },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.DiceParamsSchema.safeParse(fixture).success;
    const localResult = local.DiceParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('roulette params parity', () => {
  const fixtures: unknown[] = [
    { betType: 'straight', numbers: [17] },
    { betType: 'straight', numbers: [1, 2] },
    { betType: 'split', numbers: [1, 2] },
    { betType: 'split', numbers: [1, 36] },
    { betType: 'street', numbers: [1, 2, 3] },
    { betType: 'corner', numbers: [1, 2, 4, 5] },
    { betType: 'six-line', numbers: [1, 2, 3, 4, 5, 6] },
    { betType: 'column', numbers: [], zone: 0 },
    { betType: 'column', numbers: [] },
    { betType: 'dozen', numbers: [1], zone: 0 },
    { betType: 'red', numbers: [] },
    { betType: 'red', numbers: [1] },
    { betType: 'black', numbers: [] },
    { betType: 'odd', numbers: [] },
    { betType: 'even', numbers: [] },
    { betType: 'high', numbers: [] },
    { betType: 'low', numbers: [] },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.RouletteParamsSchema.safeParse(fixture).success;
    const localResult = local.RouletteParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('keno params parity', () => {
  const fixtures: unknown[] = [
    { risk: 'classic', picks: [4, 10, 17, 23, 31] },
    { risk: 'low', picks: [1] },
    { risk: 'high', picks: Array.from({ length: 10 }, (_, i) => i + 1) },
    // duplicate picks
    { risk: 'classic', picks: [1, 1, 2] },
    // 11 picks (exceeds max of 10)
    { risk: 'classic', picks: Array.from({ length: 11 }, (_, i) => i + 1) },
    // pick 0 (below min of 1)
    { risk: 'classic', picks: [0, 1, 2] },
    // pick 41 (above max of 40)
    { risk: 'classic', picks: [41] },
    { risk: 'medium', picks: [] },
    { risk: 'nonsense', picks: [1] },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.KenoParamsSchema.safeParse(fixture).success;
    const localResult = local.KenoParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('chicken params parity', () => {
  const fixtures: unknown[] = [
    { difficulty: 'easy', lanes: 3 },
    // easy: max lanes = 20 - 1 = 19
    { difficulty: 'easy', lanes: 19 },
    { difficulty: 'easy', lanes: 20 },
    // medium: max lanes = 20 - 3 = 17
    { difficulty: 'medium', lanes: 17 },
    { difficulty: 'medium', lanes: 18 },
    // hard: max lanes = 20 - 5 = 15
    { difficulty: 'hard', lanes: 15 },
    { difficulty: 'hard', lanes: 16 },
    // expert: max lanes = 20 - 10 = 10
    { difficulty: 'expert', lanes: 10 },
    { difficulty: 'expert', lanes: 11 },
    { difficulty: 'easy', lanes: 0 },
    { difficulty: 'easy', lanes: 1.5 },
    { difficulty: 'unknown', lanes: 3 },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.ChickenParamsSchema.safeParse(fixture).success;
    const localResult = local.ChickenParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('darts params parity', () => {
  const fixtures: unknown[] = [{}, { extra: true }, { foo: 'bar' }];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.DartsParamsSchema.safeParse(fixture).success;
    const localResult = local.DartsParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('hilo params parity', () => {
  const fixtures: unknown[] = [
    { guesses: ['higher'] },
    // valid multi-guess sequence mixing both directions
    { guesses: ['higher', 'lower', 'higher', 'lower'] },
    { guesses: Array.from({ length: 51 }, () => 'higher') },
    // 52 guesses exceeds the max of 51
    { guesses: Array.from({ length: 52 }, () => 'higher') },
    // empty array is invalid (min 1)
    { guesses: [] },
    { guesses: ['sideways'] },
    // 'equal' is no longer a valid guess -- higher/lower are now inclusive
    // (>=/<=) so a standalone "equal" guess is redundant and rejected
    { guesses: ['higher', 'lower', 'equal'] },
    { guesses: ['equal'] },
    {},
  ];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.HiLoParamsSchema.safeParse(fixture).success;
    const localResult = local.HiLoParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});

describe('blackjack params parity', () => {
  const fixtures: unknown[] = [{}, { extra: true }, { foo: 'bar' }];

  it.each(fixtures)('%j', (fixture) => {
    const realResult = real.BlackjackParamsSchema.safeParse(fixture).success;
    const localResult = local.BlackjackParamsSchema.safeParse(fixture).success;
    expect(localResult).toBe(realResult);
  });
});
