import type { ZodType } from 'zod';
import type { ReactElement } from 'react';
import {
  MinesParamsSchema,
  PlinkoParamsSchema,
  DiceParamsSchema,
  RouletteParamsSchema,
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
  type MinesParams,
  type PlinkoParams,
  type DiceParams,
  type RouletteParams,
  type KenoParams,
  type ChickenParams,
  type DartsParams,
  type HiLoParams,
  type BlackjackParams,
  type GameName,
} from './params';
import type {
  MinesOutcome,
  PlinkoOutcome,
  DiceOutcome,
  RouletteOutcome,
  KenoOutcome,
  ChickenOutcome,
  DartsOutcome,
  HiLoOutcome,
  BlackjackOutcome,
} from './types';
import { MinesParamsForm } from '@/components/params/MinesParamsForm';
import { PlinkoParamsForm } from '@/components/params/PlinkoParamsForm';
import { DiceParamsForm } from '@/components/params/DiceParamsForm';
import { RouletteParamsForm } from '@/components/params/RouletteParamsForm';
import { KenoParamsForm } from '@/components/params/KenoParamsForm';
import { ChickenParamsForm } from '@/components/params/ChickenParamsForm';
import { DartsParamsForm } from '@/components/params/DartsParamsForm';
import { HiLoParamsForm } from '@/components/params/HiLoParamsForm';
import { BlackjackParamsForm } from '@/components/params/BlackjackParamsForm';
import { MinesGrid } from '@/components/viz/MinesGrid';
import { PlinkoBoard } from '@/components/viz/PlinkoBoard';
import { DiceBar } from '@/components/viz/DiceBar';
import { RouletteResult } from '@/components/viz/RouletteResult';
import { KenoBoard } from '@/components/viz/KenoBoard';
import { ChickenLanes } from '@/components/viz/ChickenLanes';
import { DartsBoard } from '@/components/viz/DartsBoard';
import { HiLoCards } from '@/components/viz/HiLoCards';
import { BlackjackTable } from '@/components/viz/BlackjackTable';

export type { GameName };

export type ParamsFormProps<P> = {
  value: P;
  onChange: (value: P) => void;
};

export type VizProps<O, P> = {
  outcome: O;
  params: P;
  // Optional client-side staged-reveal controls (see GamePage.tsx). When
  // `staged` is true, the Viz should run its own reveal animation over the
  // already-fully-determined `outcome` and call `onRevealComplete` once
  // done. When omitted/false (e.g. VerifyForm's independent-verification
  // reuse of the same Viz), the Viz renders the final state immediately.
  staged?: boolean;
  onRevealComplete?: () => void;
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
  keno: GameRegistryEntry<KenoParams, KenoOutcome>;
  chicken: GameRegistryEntry<ChickenParams, ChickenOutcome>;
  darts: GameRegistryEntry<DartsParams, DartsOutcome>;
  hilo: GameRegistryEntry<HiLoParams, HiLoOutcome>;
  blackjack: GameRegistryEntry<BlackjackParams, BlackjackOutcome>;
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
  keno: {
    label: 'Keno',
    defaults: kenoDefaults,
    schema: KenoParamsSchema,
    ParamsForm: KenoParamsForm,
    Viz: KenoBoard,
  },
  chicken: {
    label: 'Chicken',
    defaults: chickenDefaults,
    schema: ChickenParamsSchema,
    ParamsForm: ChickenParamsForm,
    Viz: ChickenLanes,
  },
  darts: {
    label: 'Darts',
    defaults: dartsDefaults,
    schema: DartsParamsSchema,
    ParamsForm: DartsParamsForm,
    Viz: DartsBoard,
  },
  hilo: {
    label: 'HiLo',
    defaults: hiloDefaults,
    schema: HiLoParamsSchema,
    ParamsForm: HiLoParamsForm,
    Viz: HiLoCards,
  },
  blackjack: {
    label: 'Blackjack',
    defaults: blackjackDefaults,
    schema: BlackjackParamsSchema,
    ParamsForm: BlackjackParamsForm,
    Viz: BlackjackTable,
  },
};

export const GAME_NAMES = Object.keys(gamesRegistry) as GameName[];

export function isGameName(value: string): value is GameName {
  return (GAME_NAMES as string[]).includes(value);
}
