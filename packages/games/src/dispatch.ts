import { MinesParamsSchema, resolveMines } from './mines.js';
import { PlinkoParamsSchema, resolvePlinko } from './plinko.js';
import { DiceParamsSchema, resolveDice } from './dice.js';
import { RouletteParamsSchema, resolveRoulette } from './roulette.js';

// Milestone 3 covers Mines, Plinko, Dice, Roulette only. Blackjack, HiLo,
// Keno, Chicken, and Darts are Milestone 8 and are not wired up here.
export const GameDispatchTable = {
  mines: { schema: MinesParamsSchema, resolve: resolveMines },
  plinko: { schema: PlinkoParamsSchema, resolve: resolvePlinko },
  dice: { schema: DiceParamsSchema, resolve: resolveDice },
  roulette: { schema: RouletteParamsSchema, resolve: resolveRoulette },
} as const;

export type GameName = keyof typeof GameDispatchTable;
