import { MinesParamsSchema, resolveMines } from './mines.js';
import { PlinkoParamsSchema, resolvePlinko } from './plinko.js';
import { DiceParamsSchema, resolveDice } from './dice.js';
import { RouletteParamsSchema, resolveRoulette } from './roulette.js';
import { KenoParamsSchema, resolveKeno } from './keno.js';
import { ChickenParamsSchema, resolveChicken } from './chicken.js';
import { DartsParamsSchema, resolveDarts } from './darts.js';
import { HiLoParamsSchema, resolveHiLoGame } from './hilo.js';
import { BlackjackParamsSchema, resolveBlackjack } from './blackjack.js';

// All 9 games (Mines, Plinko, Dice, Roulette, Keno, Chicken, Darts, HiLo,
// Blackjack) are wired up here.
export const GameDispatchTable = {
  mines: { schema: MinesParamsSchema, resolve: resolveMines },
  plinko: { schema: PlinkoParamsSchema, resolve: resolvePlinko },
  dice: { schema: DiceParamsSchema, resolve: resolveDice },
  roulette: { schema: RouletteParamsSchema, resolve: resolveRoulette },
  keno: { schema: KenoParamsSchema, resolve: resolveKeno },
  chicken: { schema: ChickenParamsSchema, resolve: resolveChicken },
  darts: { schema: DartsParamsSchema, resolve: resolveDarts },
  hilo: { schema: HiLoParamsSchema, resolve: resolveHiLoGame },
  blackjack: { schema: BlackjackParamsSchema, resolve: resolveBlackjack },
} as const;

export type GameName = keyof typeof GameDispatchTable;
