// Ported from .claude/skills/game-logic-engineer/references/games/dice.ts
// verbatim (returns a float result 0.00-100.00) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package. Adds the target-range guard and house-edge-aware payout math
// the reference comment calls out as missing.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { applyHouseEdge } from './house-edge.js';
import { validateBetAmount } from './bet-amount.js';

export const calculateDiceRoll = (rngOptions: GeneratorOptions): number => {
  const float = createFloatGenerator(rngOptions).next().value;
  return Math.floor(float * 10001) / 100;
};

export const DiceParamsSchema = z.object({
  target: z.number().gt(0).lt(100),
  direction: z.enum(['over', 'under']),
});

export type DiceParams = z.infer<typeof DiceParamsSchema>;

export type DiceOutcome = {
  roll: number;
  target: number;
  direction: 'over' | 'under';
  win: boolean;
};

export function resolveDice(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: DiceOutcome; multiplier: number; payout: number } {
  const parsed = validateDiceParams(params);
  validateBetAmount('dice', betAmount);

  const roll = calculateDiceRoll(generatorOpts);
  const winChance =
    parsed.direction === 'under' ? parsed.target : 100 - parsed.target;
  const multiplier = applyHouseEdge(100 / winChance);
  const win =
    parsed.direction === 'under' ? roll < parsed.target : roll > parsed.target;

  const payout = win ? betAmount * multiplier : 0;

  return {
    outcome: { roll, target: parsed.target, direction: parsed.direction, win },
    multiplier,
    payout,
  };
}

function validateDiceParams(params: unknown): DiceParams {
  const result = DiceParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('dice', result.error.message);
  }
  return result.data;
}
