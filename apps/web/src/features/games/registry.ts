import type { ZodType } from 'zod';
import {
  MinesParamsSchema,
  PlinkoParamsSchema,
  DiceParamsSchema,
  RouletteParamsSchema,
  type RouletteParams,
  KenoParamsSchema,
  ChickenParamsSchema,
  DartsParamsSchema,
  HiLoParamsSchema,
  BlackjackParamsSchema,
  minesDefaults,
  plinkoDefaults,
  diceDefaults,
  rouletteDefaults,
  kenoDefaults,
  chickenDefaults,
  dartsDefaults,
  hiloDefaults,
  blackjackDefaults,
  type GameName,
} from '@/lib/params';

export type GameRegistryMeta<P = Record<string, unknown>> = {
  label: string;
  defaults: P;
  schema: ZodType<P>;
  deriveBetAmount?: (params: P) => number;
};

export const gameRegistry = {
  mines: {
    label: 'Mines',
    defaults: minesDefaults,
    schema: MinesParamsSchema,
  },
  plinko: {
    label: 'Plinko',
    defaults: plinkoDefaults,
    schema: PlinkoParamsSchema,
  },
  dice: {
    label: 'Dice',
    defaults: diceDefaults,
    schema: DiceParamsSchema,
  },
  roulette: {
    label: 'Roulette',
    defaults: rouletteDefaults,
    schema: RouletteParamsSchema,
    deriveBetAmount: (params: RouletteParams) =>
      params.bets.reduce((sum, bet) => sum + bet.amount, 0),
  },
  keno: {
    label: 'Keno',
    defaults: kenoDefaults,
    schema: KenoParamsSchema,
  },
  chicken: {
    label: 'Chicken',
    defaults: chickenDefaults,
    schema: ChickenParamsSchema,
  },
  darts: {
    label: 'Darts',
    defaults: dartsDefaults,
    schema: DartsParamsSchema,
  },
  hilo: {
    label: 'HiLo',
    defaults: hiloDefaults,
    schema: HiLoParamsSchema,
  },
  blackjack: {
    label: 'Blackjack',
    defaults: blackjackDefaults,
    schema: BlackjackParamsSchema,
  },
};

/** @deprecated Use `gameRegistry` — alias kept for gradual migration */
export const gamesRegistry = gameRegistry;

export const GAME_NAMES = Object.keys(gameRegistry) as GameName[];

export function isGameName(value: string): value is GameName {
  return (GAME_NAMES as string[]).includes(value);
}

export function getGameMeta(game: GameName): GameRegistryMeta {
  return gameRegistry[game] as unknown as GameRegistryMeta;
}