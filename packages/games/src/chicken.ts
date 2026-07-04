// Generator ported from
// .claude/skills/game-logic-engineer/references/games/chicken.ts verbatim
// (including the quirk that floatsArr[0] is drawn from the RNG stream but
// never read by the Fisher-Yates loop below, since the loop only indexes
// i = 19..1) — only the RNG import/naming has been fixed to match the
// real @cplatform/core-rng package.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { nCr } from './combinatorics.js';
import { applyHouseEdge } from './house-edge.js';
import { validateBetAmount } from './bet-amount.js';

export enum ChickenDifficultySlice {
  EASY = 1,
  MEDIUM = 3,
  HARD = 5,
  EXPERT = 10,
}

export type ChickenDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const CHICKEN_DIFFICULTY_TO_SLICE: Record<
  ChickenDifficulty,
  ChickenDifficultySlice
> = {
  easy: ChickenDifficultySlice.EASY,
  medium: ChickenDifficultySlice.MEDIUM,
  hard: ChickenDifficultySlice.HARD,
  expert: ChickenDifficultySlice.EXPERT,
};

export const CHICKEN_LANES_COUNT = 20;

export type ChickenRNGOptions = GeneratorOptions & {
  difficultySlice: ChickenDifficultySlice;
};

export const chickenRandomShuffle = (floatsArr: number[]): number[] => {
  const deathPointArr = Array.from({ length: CHICKEN_LANES_COUNT }, (_, i) => i + 1);

  for (let i = deathPointArr.length - 1; i > 0; i--) {
    const j = Math.floor(floatsArr[i]! * (i + 1));
    [deathPointArr[i], deathPointArr[j]] = [deathPointArr[j]!, deathPointArr[i]!];
  }

  return deathPointArr;
};

export const calculateChickenDeathPoint = (options: ChickenRNGOptions): number => {
  const floats = createFloatGenerator(options);
  const floatsArr = Array.from({ length: CHICKEN_LANES_COUNT }, () => floats.next().value);

  const shuffledArr = chickenRandomShuffle(floatsArr);
  const slicedShuffledArr = shuffledArr.slice(0, options.difficultySlice);

  return Math.min(...slicedShuffledArr);
};

// --- Params / payout ---------------------------------------------------

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

export function chickenMultiplier(
  difficulty: ChickenDifficulty,
  lanes: number
): number {
  const d = CHICKEN_DIFFICULTY_TO_SLICE[difficulty];
  return applyHouseEdge(
    nCr(CHICKEN_LANES_COUNT, d) / nCr(CHICKEN_LANES_COUNT - lanes, d)
  );
}

export type ChickenOutcome = {
  deathPoint: number;
  win: boolean;
};

export function resolveChicken(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: ChickenOutcome; multiplier: number; payout: number } {
  const parsed = validateChickenParams(params);
  validateBetAmount('chicken', betAmount);

  const difficultySlice = CHICKEN_DIFFICULTY_TO_SLICE[parsed.difficulty];
  const deathPoint = calculateChickenDeathPoint({ ...generatorOpts, difficultySlice });
  const win = deathPoint > parsed.lanes;

  const multiplier = chickenMultiplier(parsed.difficulty, parsed.lanes);
  const payout = win ? betAmount * multiplier : 0;

  return {
    outcome: { deathPoint, win },
    multiplier,
    payout,
  };
}

function validateChickenParams(params: unknown): ChickenParams {
  const result = ChickenParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('chicken', result.error.message);
  }
  return result.data;
}
