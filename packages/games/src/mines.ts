// Ported from .claude/skills/game-logic-engineer/references/games/mines.ts
// (verbatim algorithm; only the RNG import/naming has been fixed to match
// the real @cplatform/core-rng package).

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { nCr } from './combinatorics.js';
import { applyHouseEdge } from './house-edge.js';
import { validateBetAmount } from './bet-amount.js';

export const MINES_GAME_TILES_COUNT = 25;

export type MinesRNGOptions = GeneratorOptions & { mines: number };

export const calculateMinesPositions = ({
  mines,
  ...rngOptions
}: MinesRNGOptions): number[] => {
  const floatsRng = createFloatGenerator(rngOptions);

  const remainingPositions = Array(MINES_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => index); // [0, 1, 2, ... 24]

  return Array(mines)
    .fill(0)
    .map((_, index) => {
      const float = floatsRng.next().value;

      const relativeMinePosition = Math.floor(
        float * (MINES_GAME_TILES_COUNT - index)
      );
      const [absoluteMinePosition] = remainingPositions.splice(
        relativeMinePosition,
        1
      );

      return absoluteMinePosition as number;
    })
    .sort((left, right) => left - right);
};

// Derives a full 25-element reveal order (permutation of tile indices 0-24)
// using the same partial-Fisher-Yates-via-splice pattern as
// calculateMinesPositions, but run to completion over ALL tiles rather than
// stopping at `mines` draws. This lets us determine, deterministically and
// independent of the mine-position derivation above, which tiles a player
// would reveal (in order) and whether any of the first `picks` reveals hit
// a mine.
//
// Domain separation: calculateMinesPositions and deriveRevealOrder must NOT
// draw from the identical float stream, or the reveal order's first `mines`
// draws would exactly reproduce the mine positions (guaranteeing a "hit"
// every round). We derive an independent stream by suffixing the client
// seed, keeping everything else (serverSeed, nonce) — and therefore
// reproducibility/verifiability from the committed server seed — intact.
export const deriveRevealOrder = (rngOptions: GeneratorOptions): number[] => {
  const floatsRng = createFloatGenerator({
    ...rngOptions,
    clientSeed: `${rngOptions.clientSeed}:reveal-order`,
  });

  const remainingPositions = Array(MINES_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => index);

  return Array(MINES_GAME_TILES_COUNT)
    .fill(0)
    .map((_, index) => {
      const float = floatsRng.next().value;
      const relativePosition = Math.floor(
        float * (MINES_GAME_TILES_COUNT - index)
      );
      const [absolutePosition] = remainingPositions.splice(relativePosition, 1);
      return absolutePosition as number;
    });
};

export const MinesParamsSchema = z
  .object({
    mines: z.number().int().min(1).max(24),
    picks: z.number().int().min(0),
  })
  .refine((p) => p.picks <= MINES_GAME_TILES_COUNT - p.mines, {
    message: 'picks exceeds safe tile count',
  });

export type MinesParams = z.infer<typeof MinesParamsSchema>;

// Round-start params for the cash-out flow: just the mine count -- `picks`
// no longer belongs here since tiles are now revealed one at a time via
// separate round-action calls rather than chosen all upfront.
export const MinesRoundStartParamsSchema = z.object({
  mines: z.number().int().min(1).max(24),
});

export type MinesRoundStartParams = z.infer<typeof MinesRoundStartParamsSchema>;

export function minesMultiplier(mines: number, picks: number): number {
  if (picks === 0) return 1;
  return applyHouseEdge(
    nCr(MINES_GAME_TILES_COUNT, picks) / nCr(MINES_GAME_TILES_COUNT - mines, picks)
  );
}

export type MinesOutcome = {
  minePositions: number[];
  revealOrder: number[];
  hitMine: boolean;
};

export function resolveMines(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: MinesOutcome; multiplier: number; payout: number } {
  const parsed = validateMinesParams(params);
  validateBetAmount('mines', betAmount);

  const minePositions = calculateMinesPositions({
    ...generatorOpts,
    mines: parsed.mines,
  });
  const revealOrder = deriveRevealOrder(generatorOpts).slice(0, parsed.picks);

  const minePositionSet = new Set(minePositions);
  const hitMine = revealOrder.some((tile) => minePositionSet.has(tile));

  const multiplier = minesMultiplier(parsed.mines, parsed.picks);
  const payout = hitMine ? 0 : betAmount * multiplier;

  return {
    outcome: { minePositions, revealOrder, hitMine },
    multiplier,
    payout,
  };
}

// --- Round-state primitives (Mines cash-out) -------------------------------
//
// `resolveMines(picks=k)` above already derives the *entire* 25-tile mine
// layout and reveal order from one deterministic nonce draw, and checking
// the first k reveal-order tiles against the mine positions is already
// exactly "what happens if the player reveals k tiles and stops." These two
// functions just decompose that existing logic into a "derive once at
// round-start" step and a "re-evaluate incrementally per action" step, so a
// round-based flow can reveal one tile at a time without any new RNG design
// or new float draws per action -- reused as-is by roundService.

export type MinesRoundState = {
  minePositions: number[];
  revealOrder: number[];
};

export function deriveMinesRoundState(
  generatorOpts: GeneratorOptions,
  mines: number
): MinesRoundState {
  return {
    minePositions: calculateMinesPositions({ ...generatorOpts, mines }),
    revealOrder: deriveRevealOrder(generatorOpts),
  };
}

export function evaluateMinesReveal(
  state: MinesRoundState,
  mines: number,
  revealedCount: number
): { tile: number; hitMine: boolean; multiplier: number } {
  const tile = state.revealOrder[revealedCount - 1];
  if (tile === undefined) {
    throw new InvalidBetParamsError('mines', 'revealedCount exceeds board size');
  }
  const hitMine = new Set(state.minePositions).has(tile);
  const multiplier = minesMultiplier(mines, revealedCount);
  return { tile, hitMine, multiplier };
}

function validateMinesParams(params: unknown): MinesParams {
  const result = MinesParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('mines', result.error.message);
  }
  return result.data;
}
