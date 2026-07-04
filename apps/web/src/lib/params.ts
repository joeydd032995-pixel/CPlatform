// LOCAL Zod schemas mirroring the server's exactly (packages/games/src/
// {mines,plinko,dice,roulette,bet-amount}.ts), re-declared here rather than
// imported at runtime so this package never pulls @cplatform/games (and
// therefore @cplatform/core-rng / Node's `crypto`) into a client bundle.
// params.parity.test.ts cross-checks these against the real schemas
// (imported at runtime, node-env only) so drift gets caught in CI.
import { z } from 'zod';

// --- betAmount (packages/games/src/bet-amount.ts) --------------------------
// validateBetAmount() only requires a positive, finite number -- no
// game-specific min/max exists server-side today, so the client mirrors
// exactly that (plus a practical upper display bound isn't imposed here on
// purpose: the server is the source of truth for any future cap).
export const BetAmountSchema = z
  .number()
  .refine((n) => Number.isFinite(n), { message: 'Bet amount must be a finite number' })
  .refine((n) => n > 0, { message: 'Bet amount must be greater than 0' });

// --- mines (packages/games/src/mines.ts) -----------------------------------
export const MINES_GAME_TILES_COUNT = 25;

export const MinesParamsSchema = z
  .object({
    mines: z.number().int().min(1).max(24),
    picks: z.number().int().min(0),
  })
  .refine((p) => p.picks <= MINES_GAME_TILES_COUNT - p.mines, {
    message: 'picks exceeds safe tile count',
  });

export type MinesParams = z.infer<typeof MinesParamsSchema>;

export const minesDefaults: MinesParams = { mines: 3, picks: 1 };

// --- plinko (packages/games/src/plinko.ts) ---------------------------------
export const PlinkoParamsSchema = z.object({
  rows: z.number().int().min(8).max(16),
  risk: z.enum(['low', 'medium', 'high']),
});

export type PlinkoParams = z.infer<typeof PlinkoParamsSchema>;

export const plinkoDefaults: PlinkoParams = { rows: 12, risk: 'medium' };

// --- dice (packages/games/src/dice.ts) -------------------------------------
export const DiceParamsSchema = z.object({
  target: z.number().gt(0).lt(100),
  direction: z.enum(['over', 'under']),
});

export type DiceParams = z.infer<typeof DiceParamsSchema>;

export const diceDefaults: DiceParams = { target: 50, direction: 'over' };

// --- roulette (packages/games/src/roulette.ts) -----------------------------
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

// Re-derived from the same 12x3 felt model as the server (row r, col c ->
// number = r*3 + c + 1). Only the small adjacency tables actually needed
// for client-side refinement are rebuilt here.
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
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 1; col++) {
      splits.push([numberAt(row, col), numberAt(row, col + 1)]);
    }
  }
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
            message: 'corner bets require 4 numbers forming a valid 2x2 felt block',
          });
        }
        break;
      }
      case 'six-line': {
        if (p.numbers.length !== 6 || !SIX_LINE_KEYS.has(sortedKey(p.numbers))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'six-line bets require 6 numbers forming two adjacent felt rows',
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

export const rouletteDefaults: RouletteParams = {
  betType: 'red',
  numbers: [],
};

// --- keno (packages/games/src/keno.ts) -------------------------------------
export const KENO_GAME_TILES_COUNT = 40;
export const KENO_GAME_TILES_HIT_COUNT = 10;

export const KenoParamsSchema = z.object({
  risk: z.enum(['classic', 'low', 'medium', 'high']),
  picks: z
    .array(z.number().int().min(1).max(KENO_GAME_TILES_COUNT))
    .min(1)
    .max(KENO_GAME_TILES_HIT_COUNT)
    .refine((picks) => new Set(picks).size === picks.length, {
      message: 'picks must be unique',
    }),
});

export type KenoParams = z.infer<typeof KenoParamsSchema>;

export const kenoDefaults: KenoParams = {
  risk: 'classic',
  picks: [4, 10, 17, 23, 31],
};

// --- chicken (packages/games/src/chicken.ts) -------------------------------
export const CHICKEN_LANES_COUNT = 20;

export const CHICKEN_DIFFICULTY_TO_SLICE: Record<
  'easy' | 'medium' | 'hard' | 'expert',
  number
> = {
  easy: 1,
  medium: 3,
  hard: 5,
  expert: 10,
};

export const ChickenParamsSchema = z
  .object({
    difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
    lanes: z.number().int().min(1),
  })
  .refine(
    (p) => p.lanes <= CHICKEN_LANES_COUNT - CHICKEN_DIFFICULTY_TO_SLICE[p.difficulty],
    { message: 'lanes exceeds the maximum allowed for this difficulty' }
  );

export type ChickenParams = z.infer<typeof ChickenParamsSchema>;

export const chickenDefaults: ChickenParams = { difficulty: 'easy', lanes: 3 };

// --- darts (packages/games/src/darts.ts) -----------------------------------
export const DartsParamsSchema = z.object({}).strict();

export type DartsParams = z.infer<typeof DartsParamsSchema>;

export const dartsDefaults: DartsParams = {};

// --- hilo (packages/games/src/hilo.ts) -------------------------------------
export const HiLoGuessSchema = z.enum(['higher', 'lower']);

export const HiLoParamsSchema = z.object({
  guesses: z.array(HiLoGuessSchema).min(1).max(51),
});

export type HiLoGuess = z.infer<typeof HiLoGuessSchema>;
export type HiLoParams = z.infer<typeof HiLoParamsSchema>;

export const hiloDefaults: HiLoParams = { guesses: ['higher'] };

// --- blackjack (packages/games/src/blackjack.ts) ---------------------------
export const BlackjackParamsSchema = z.object({}).strict();

export type BlackjackParams = z.infer<typeof BlackjackParamsSchema>;

export const blackjackDefaults: BlackjackParams = {};

// --- registry-friendly union ------------------------------------------------
export type GameName =
  | 'mines'
  | 'plinko'
  | 'dice'
  | 'roulette'
  | 'keno'
  | 'chicken'
  | 'darts'
  | 'hilo'
  | 'blackjack';
