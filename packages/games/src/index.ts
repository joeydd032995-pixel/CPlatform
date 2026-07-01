export { nCr } from './combinatorics.js';
export { applyHouseEdge, expectedRTP } from './house-edge.js';

export {
  MINES_GAME_TILES_COUNT,
  calculateMinesPositions,
  deriveRevealOrder,
  MinesParamsSchema,
  minesMultiplier,
  resolveMines,
} from './mines.js';
export type { MinesRNGOptions, MinesParams, MinesOutcome } from './mines.js';

export {
  PlinkoBallMove,
  PlinkoRisk,
  calculatePlinkoBallPath,
  getPlinkoMultipliersTable,
  plinkoBallPathToMultiplierIndex,
  calculatePlinkoMultiplier,
  toPlinkoRisk,
  PlinkoParamsSchema,
  resolvePlinko,
} from './plinko.js';
export type {
  PlinkoBallPath,
  PlinkoRNGOptions,
  PlinkoMultipliersTable,
  PlinkoParams,
  PlinkoOutcome,
} from './plinko.js';

export { calculateDiceRoll, DiceParamsSchema, resolveDice } from './dice.js';
export type { DiceParams, DiceOutcome } from './dice.js';

export {
  RouletteColor,
  rouletteNumbersArray,
  calculateRouletteResult,
  rouletteResultToColor,
  rouletteMultiplier,
  ROULETTE_STREETS,
  ROULETTE_SIX_LINES,
  ROULETTE_CORNERS,
  ROULETTE_SPLITS,
  REAL_RED_NUMBERS,
  RouletteBetTypeSchema,
  RouletteParamsSchema,
  resolveRoulette,
} from './roulette.js';
export type {
  RouletteResult,
  RouletteBetType,
  RouletteParams,
  RouletteOutcome,
} from './roulette.js';

export { GameDispatchTable } from './dispatch.js';
export type { GameName } from './dispatch.js';
