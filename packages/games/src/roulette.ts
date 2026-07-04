// Ported from .claude/skills/game-logic-engineer/references/games/roulette.ts
// verbatim (enum, numbers array, result/color derivation) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { validateBetAmount } from './bet-amount.js';

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

// --- European single-zero payout table (already the authentic house edge) --
//
// These are the REAL European (single-zero) total-return multipliers, not a
// "pre-edge" figure to be discounted further. Each one already yields
// EV = (coverage / 37) * payout = 36/37 ~= 0.97297 -- e.g. straight-up pays
// 36x on a 1/37 chance, split pays 18x on a 2/37 chance, red/black pays 2x on
// an 18/37 chance, etc. The house's ~2.7% edge comes STRUCTURALLY from the
// 37th pocket (the single zero, on which every outside/inside bet other than
// a 0-covering straight loses) -- it is not, and must not be, layered on top
// via `applyHouseEdge` as well. Doing so previously double-counted the edge
// (36/37 * 0.99 ~= 0.9632 instead of the authentic 36/37 ~= 0.97297) -- that
// was the bug this table's naming/usage now fixes. Unlike every other game
// on this platform, roulette therefore intentionally does NOT call
// `applyHouseEdge` anywhere in its payout path.
const EUROPEAN_PAYOUTS: Record<RouletteBetType, number> = {
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
  return EUROPEAN_PAYOUTS[betType];
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
// simplified column/row grid model above). Module-private and never
// exported as a mutable Set — isWin()'s red/black bets depend on its
// contents staying fixed; an external .clear()/.add()/.delete() would
// silently corrupt roulette resolution process-wide.
const REAL_RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// --- Params schema -----------------------------------------------------
//
// Multi-chip betting: a single spin/request now carries an *array* of
// individually-staked bets (real casino felt semantics — several
// simultaneous bets, one spin settles all of them). `RouletteSingleBetSchema`
// is today's flat per-bet shape plus its own `amount`; the top-level
// `RouletteParamsSchema` just wraps an array of those.

export const RouletteSingleBetSchema = z
  .object({
    betType: RouletteBetTypeSchema,
    numbers: z.array(z.number().int().min(0).max(36)),
    zone: z.number().int().min(0).max(2).optional(),
    amount: z.number().positive(),
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

export type RouletteSingleBet = z.infer<typeof RouletteSingleBetSchema>;

export const RouletteParamsSchema = z.object({
  bets: z.array(RouletteSingleBetSchema).min(1).max(40), // 40 = generous cap, defensive only
});

export type RouletteParams = z.infer<typeof RouletteParamsSchema>;

// --- Win determination ---------------------------------------------------
//
// `isWin` only ever reads `betType`/`numbers`/`zone` off whatever object
// it's given, so passing a `RouletteSingleBet` (which also carries `amount`)
// works completely unchanged.

function isWin(result: RouletteResult, params: RouletteSingleBet): boolean {
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

export type RouletteBetResult = {
  betType: RouletteBetType;
  numbers: number[];
  zone?: number;
  amount: number;
  win: boolean;
  payout: number;
};

export type RouletteOutcome = {
  result: RouletteResult;
  color: RouletteColor;
  win: boolean; // repurposed: true iff ANY bet won this spin
  bets: RouletteBetResult[]; // per-bet breakdown, same order as the request
};

export function resolveRoulette(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: RouletteOutcome; multiplier: number; payout: number } {
  const parsed = validateRouletteParams(params);
  validateBetAmount('roulette', betAmount);

  // Reconciliation guard: `gameService.playGame` debits/credits strictly
  // against this single top-level `betAmount` *before* `resolve()` runs, so
  // a mismatched `bets[]` total would let a client under-declare the debit
  // while over-declaring the payout stake. Reject before any spin happens.
  const sumOfBets = parsed.bets.reduce((sum, bet) => sum + bet.amount, 0);
  if (Math.abs(sumOfBets - betAmount) > 1e-9) {
    throw new InvalidBetParamsError(
      'roulette',
      'sum of per-bet amounts must equal betAmount'
    );
  }

  // Exactly one float draw / one physical spin settles every simultaneous
  // bet in `parsed.bets`, no matter how many bets were placed — this is the
  // whole point of multi-chip betting (one spin, many bets) and must not be
  // turned into a per-bet draw loop.
  const result = calculateRouletteResult(generatorOpts);
  const color = rouletteResultToColor(result);

  const betResults: RouletteBetResult[] = parsed.bets.map((bet) => {
    const win = isWin(result, bet);
    const payout = win ? bet.amount * rouletteMultiplier(bet.betType) : 0;
    return {
      betType: bet.betType,
      numbers: bet.numbers,
      zone: bet.zone,
      amount: bet.amount,
      win,
      payout,
    };
  });

  const totalPayout = betResults.reduce((sum, b) => sum + b.payout, 0);
  const overallWin = betResults.some((b) => b.win);

  // Display-only stake ratio (totalPayout / totalStake) — NOT used in any
  // further math; every bet's payout above is already fully computed
  // per-bet. Do not mistake this for a single-bet-type multiplier lookup.
  const multiplier = betAmount > 0 ? totalPayout / betAmount : 0;

  return {
    outcome: { result, color, win: overallWin, bets: betResults },
    multiplier,
    payout: totalPayout,
  };
}

function validateRouletteParams(params: unknown): RouletteParams {
  const result = RouletteParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('roulette', result.error.message);
  }
  return result.data;
}
