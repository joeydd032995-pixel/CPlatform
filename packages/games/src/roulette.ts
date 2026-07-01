// Ported from .claude/skills/game-logic-engineer/references/games/roulette.ts
// verbatim (enum, numbers array, result/color derivation) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { applyHouseEdge } from './house-edge.js';

export enum RouletteColor {
  Green = 'green',
  Red = 'red',
  Black = 'black',
}

export const rouletteNumbersArray = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
] as const;

export type RouletteResult = (typeof rouletteNumbersArray)[number];

export const calculateRouletteResult = ({
  serverSeed,
  clientSeed,
  nonce,
}: GeneratorOptions): RouletteResult => {
  const float = createFloatGenerator({ serverSeed, clientSeed, nonce }).next()
    .value;
  return Math.floor(float * 37) as RouletteResult;
};

export const rouletteResultToColor = (
  rouletteResult: RouletteResult
): RouletteColor => {
  if (rouletteResult === 0) {
    return RouletteColor.Green;
  } else if (
    (rouletteResult >= 1 && rouletteResult <= 10) ||
    (rouletteResult >= 19 && rouletteResult <= 28)
  ) {
    return rouletteResult % 2 === 0 ? RouletteColor.Black : RouletteColor.Red;
  } else if (
    (rouletteResult >= 11 && rouletteResult <= 18) ||
    (rouletteResult >= 29 && rouletteResult <= 36)
  ) {
    return rouletteResult % 2 === 0 ? RouletteColor.Red : RouletteColor.Black;
  }
  return RouletteColor.Black;
};

// --- Bet type -----------------------------------------------------------

export const RouletteBetTypeSchema = z.enum([
  'straight',
  'split',
  'street',
  'corner',
  'six-line',
  'column',
  'dozen',
  'red',
  'black',
  'odd',
  'even',
  'high',
  'low',
]);

export type RouletteBetType = z.infer<typeof RouletteBetTypeSchema>;

// --- Fair payout table (before house edge) ---------------------------------

const FAIR_PAYOUTS: Record<RouletteBetType, number> = {
  straight: 36,
  split: 18,
  street: 12,
  corner: 9,
  'six-line': 6,
  column: 3,
  dozen: 3,
  red: 2,
  black: 2,
  odd: 2,
  even: 2,
  high: 2,
  low: 2,
};

export function rouletteMultiplier(betType: RouletteBetType): number {
  return applyHouseEdge(FAIR_PAYOUTS[betType]);
}

// --- Felt adjacency model ----------------------------------------------
//
// Models the standard European felt as 12 rows x 3 columns containing
// numbers 1-36 (row r, col c -> number = r*3 + c + 1, r in 0..11, c in
// 0..2). 0 is handled separately and, in this simplified model, only
// supports straight-up bets — real felts also allow 0-adjacent
// splits/corners (e.g. 0/1, 0/2, 0/3, 0/1/2/3), but that is deferred here
// as a documented future enhancement.

const GRID_ROWS = 12;
const GRID_COLS = 3;

function numberAt(row: number, col: number): number {
  return row * GRID_COLS + col + 1;
}

function sortedKey(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join(',');
}

function buildStreets(): number[][] {
  const streets: number[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    streets.push([numberAt(row, 0), numberAt(row, 1), numberAt(row, 2)]);
  }
  return streets;
}

function buildSixLines(): number[][] {
  const sixLines: number[][] = [];
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    sixLines.push([
      numberAt(row, 0),
      numberAt(row, 1),
      numberAt(row, 2),
      numberAt(row + 1, 0),
      numberAt(row + 1, 1),
      numberAt(row + 1, 2),
    ]);
  }
  return sixLines;
}

function buildCorners(): number[][] {
  const corners: number[][] = [];
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    for (let col = 0; col < GRID_COLS - 1; col++) {
      corners.push([
        numberAt(row, col),
        numberAt(row, col + 1),
        numberAt(row + 1, col),
        numberAt(row + 1, col + 1),
      ]);
    }
  }
  return corners;
}

function buildSplits(): number[][] {
  const splits: number[][] = [];
  // Horizontal adjacency (within a row).
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 1; col++) {
      splits.push([numberAt(row, col), numberAt(row, col + 1)]);
    }
  }
  // Vertical adjacency (between rows, same column).
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      splits.push([numberAt(row, col), numberAt(row + 1, col)]);
    }
  }
  return splits;
}

export const ROULETTE_STREETS = buildStreets();
export const ROULETTE_SIX_LINES = buildSixLines();
export const ROULETTE_CORNERS = buildCorners();
export const ROULETTE_SPLITS = buildSplits();

const STREET_KEYS = new Set(ROULETTE_STREETS.map(sortedKey));
const SIX_LINE_KEYS = new Set(ROULETTE_SIX_LINES.map(sortedKey));
const CORNER_KEYS = new Set(ROULETTE_CORNERS.map(sortedKey));
const SPLIT_KEYS = new Set(ROULETTE_SPLITS.map(sortedKey));

// Real European wheel red numbers (fixed lookup fact, independent of the
// simplified column/row grid model above).
export const REAL_RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// --- Params schema -----------------------------------------------------

export const RouletteParamsSchema = z
  .object({
    betType: RouletteBetTypeSchema,
    numbers: z.array(z.number().int().min(0).max(36)),
    zone: z.number().int().min(0).max(2).optional(),
  })
  .superRefine((p, ctx) => {
    switch (p.betType) {
      case 'straight': {
        if (p.numbers.length !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'straight bets require exactly 1 number',
          });
        }
        break;
      }
      case 'split': {
        if (p.numbers.length !== 2 || !SPLIT_KEYS.has(sortedKey(p.numbers))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'split bets require 2 numbers forming a valid felt split',
          });
        }
        break;
      }
      case 'street': {
        if (p.numbers.length !== 3 || !STREET_KEYS.has(sortedKey(p.numbers))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'street bets require 3 numbers forming a valid felt row',
          });
        }
        break;
      }
      case 'corner': {
        if (p.numbers.length !== 4 || !CORNER_KEYS.has(sortedKey(p.numbers))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'corner bets require 4 numbers forming a valid 2x2 felt block',
          });
        }
        break;
      }
      case 'six-line': {
        if (
          p.numbers.length !== 6 ||
          !SIX_LINE_KEYS.has(sortedKey(p.numbers))
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'six-line bets require 6 numbers forming two adjacent felt rows',
          });
        }
        break;
      }
      case 'column':
      case 'dozen': {
        if (p.numbers.length !== 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${p.betType} bets must not specify numbers`,
          });
        }
        if (p.zone === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${p.betType} bets require a zone (0, 1, or 2)`,
          });
        }
        break;
      }
      case 'red':
      case 'black':
      case 'odd':
      case 'even':
      case 'high':
      case 'low': {
        if (p.numbers.length !== 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${p.betType} bets must not specify numbers`,
          });
        }
        break;
      }
    }
  });

export type RouletteParams = z.infer<typeof RouletteParamsSchema>;

// --- Win determination ---------------------------------------------------

function isWin(result: RouletteResult, params: RouletteParams): boolean {
  switch (params.betType) {
    case 'straight':
    case 'split':
    case 'street':
    case 'corner':
    case 'six-line':
      return params.numbers.includes(result);
    case 'column':
      return result !== 0 && (result - 1) % 3 === params.zone;
    case 'dozen':
      return (
        result !== 0 &&
        Math.floor((result - 1) / 12) === params.zone
      );
    case 'red':
      return REAL_RED_NUMBERS.has(result);
    case 'black':
      return result !== 0 && !REAL_RED_NUMBERS.has(result);
    case 'odd':
      return result !== 0 && result % 2 === 1;
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'high':
      return result >= 19 && result <= 36;
    case 'low':
      return result >= 1 && result <= 18;
  }
}

export type RouletteOutcome = {
  result: RouletteResult;
  color: RouletteColor;
  win: boolean;
};

export function resolveRoulette(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: RouletteOutcome; multiplier: number; payout: number } {
  const parsed = validateRouletteParams(params);

  const result = calculateRouletteResult(generatorOpts);
  const color = rouletteResultToColor(result);
  const win = isWin(result, parsed);

  const multiplier = rouletteMultiplier(parsed.betType);
  const payout = win ? betAmount * multiplier : 0;

  return {
    outcome: { result, color, win },
    multiplier,
    payout,
  };
}

function validateRouletteParams(params: unknown): RouletteParams {
  const result = RouletteParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('roulette', result.error.message);
  }
  return result.data;
}
