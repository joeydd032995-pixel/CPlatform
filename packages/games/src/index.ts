export { nCr } from './combinatorics.js';
export { applyHouseEdge, expectedRTP } from './house-edge.js';
export { validateBetAmount } from './bet-amount.js';

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

export {
  CardSuit,
  cardSuits,
  cardRanks,
  deck,
  getCardSuit,
  getCardRank,
  getCardRankValue,
  cardToCardId,
  cardIdToCard,
  isCard,
  drawCardFromFloat,
} from './deck.js';
export type { Card, CardRank, CardRankValue } from './deck.js';

export {
  KENO_GAME_TILES_COUNT,
  KENO_GAME_TILES_HIT_COUNT,
  calculateKenoHitPositions,
  kenoMultiplierTable,
  kenoMultiplier,
  KenoParamsSchema,
  resolveKeno,
} from './keno.js';
export type { KenoRisk, KenoParams, KenoOutcome } from './keno.js';

export {
  ChickenDifficultySlice,
  CHICKEN_DIFFICULTY_TO_SLICE,
  CHICKEN_LANES_COUNT,
  chickenRandomShuffle,
  calculateChickenDeathPoint,
  chickenMultiplier,
  ChickenParamsSchema,
  resolveChicken,
} from './chicken.js';
export type {
  ChickenDifficulty,
  ChickenRNGOptions,
  ChickenParams,
  ChickenOutcome,
} from './chicken.js';

export {
  calculateDartThrow,
  DARTS_ZONES,
  dartsZoneForDistance,
  DartsParamsSchema,
  resolveDarts,
} from './darts.js';
export type { DartsZone, DartsParams, DartsOutcome } from './darts.js';

export {
  HILO_GAME_MAX_ROUNDS_SOFT_LIMIT,
  HILO_HOUSE_EDGE,
  calculateHiloResults,
  resolveHiLo,
  HiLoGuessSchema,
  HiLoParamsSchema,
  resolveHiLoGame,
} from './hilo.js';
export type {
  CalculateHiloResultsOptions,
  HiLoGuess,
  HiLoParams,
  HiLoStep,
  HiLoOutcome,
} from './hilo.js';

export {
  calculateBlackjackResults,
  handValue,
  isNatural,
  shouldPlayerHit,
  shouldDealerHit,
  BlackjackParamsSchema,
  resolveBlackjack,
} from './blackjack.js';
export type {
  CalculateBlackjackResultsOptions,
  HandValue,
  BlackjackParams,
  BlackjackResult,
  BlackjackOutcome,
} from './blackjack.js';

export { GameDispatchTable } from './dispatch.js';
export type { GameName } from './dispatch.js';
