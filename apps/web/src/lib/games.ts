import type { ZodType } from 'zod';
import type { ReactElement } from 'react';
import {
  MinesParamsSchema,
  PlinkoParamsSchema,
  DiceParamsSchema,
  RouletteParamsSchema,
  minesDefaults,
  plinkoDefaults,
  diceDefaults,
  rouletteDefaults,
  type MinesParams,
  type PlinkoParams,
  type DiceParams,
  type RouletteParams,
  type GameName,
} from './params';
import type { MinesOutcome, PlinkoOutcome, DiceOutcome, RouletteOutcome } from './types';
import { MinesParamsForm } from '@/components/params/MinesParamsForm';
import { PlinkoParamsForm } from '@/components/params/PlinkoParamsForm';
import { DiceParamsForm } from '@/components/params/DiceParamsForm';
import { RouletteParamsForm } from '@/components/params/RouletteParamsForm';
import { MinesGrid } from '@/components/viz/MinesGrid';
import { PlinkoBoard } from '@/components/viz/PlinkoBoard';
import { DiceBar } from '@/components/viz/DiceBar';
import { RouletteResult } from '@/components/viz/RouletteResult';

export type { GameName };

export type ParamsFormProps<P> = {
  value: P;
  onChange: (value: P) => void;
};

export type VizProps<O, P> = {
  outcome: O;
  params: P;
};

export type GameRegistryEntry<P, O> = {
  label: string;
  defaults: P;
  schema: ZodType<P>;
  ParamsForm: (props: ParamsFormProps<P>) => ReactElement;
  Viz: (props: VizProps<O, P>) => ReactElement;
};

export type GamesRegistry = {
  mines: GameRegistryEntry<MinesParams, MinesOutcome>;
  plinko: GameRegistryEntry<PlinkoParams, PlinkoOutcome>;
  dice: GameRegistryEntry<DiceParams, DiceOutcome>;
  roulette: GameRegistryEntry<RouletteParams, RouletteOutcome>;
};

export const gamesRegistry: GamesRegistry = {
  mines: {
    label: 'Mines',
    defaults: minesDefaults,
    schema: MinesParamsSchema,
    ParamsForm: MinesParamsForm,
    Viz: MinesGrid,
  },
  plinko: {
    label: 'Plinko',
    defaults: plinkoDefaults,
    schema: PlinkoParamsSchema,
    ParamsForm: PlinkoParamsForm,
    Viz: PlinkoBoard,
  },
  dice: {
    label: 'Dice',
    defaults: diceDefaults,
    schema: DiceParamsSchema,
    ParamsForm: DiceParamsForm,
    Viz: DiceBar,
  },
  roulette: {
    label: 'Roulette',
    defaults: rouletteDefaults,
    schema: RouletteParamsSchema,
    ParamsForm: RouletteParamsForm,
    Viz: RouletteResult,
  },
};

export const GAME_NAMES = Object.keys(gamesRegistry) as GameName[];

export function isGameName(value: string): value is GameName {
  return (GAME_NAMES as string[]).includes(value);
}
