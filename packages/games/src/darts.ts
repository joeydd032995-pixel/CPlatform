// Generator ported from
// .claude/skills/game-logic-engineer/references/games/darts.ts verbatim
// (distance = sqrt(float) * 0.5, rotation = float) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package.
//
// Zone table derived so that Sigma(p_zone * multiplier_zone) == 0.99
// exactly, uniform over u = 4*distance^2 in [0,1) (distance is
// sqrt-distributed in [0,0.5), so u is uniform in [0,1)). The house edge
// is baked into these multipliers; resolveDarts must NOT run the looked-up
// multiplier through applyHouseEdge again.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';
import { validateBetAmount } from './bet-amount.js';

export const calculateDartThrow = (
  options: GeneratorOptions
): { distance: number; rotation: number } => {
  const floats = createFloatGenerator(options);

  const distance = Math.sqrt(floats.next().value) * 0.5;
  const rotation = floats.next().value;

  return { distance, rotation };
};

export type DartsZone = {
  name: 'bullseye' | 'inner' | 'middle' | 'outer' | 'rim';
  // Bounds on u = 4 * distance^2 (uniform in [0, 1)), [from, to).
  from: number;
  to: number;
  multiplier: number;
};

// Sigma(p * m): 0.02*15 + 0.08*4 + 0.20*1.2 + 0.30*0.3 + 0.40*0.1 = 0.99 exactly.
export const DARTS_ZONES: readonly DartsZone[] = [
  { name: 'bullseye', from: 0, to: 0.02, multiplier: 15 },
  { name: 'inner', from: 0.02, to: 0.1, multiplier: 4 },
  { name: 'middle', from: 0.1, to: 0.3, multiplier: 1.2 },
  { name: 'outer', from: 0.3, to: 0.6, multiplier: 0.3 },
  { name: 'rim', from: 0.6, to: 1, multiplier: 0.1 },
];

export function dartsZoneForDistance(distance: number): {
  zone: DartsZone['name'];
  zoneIndex: number;
  multiplier: number;
} {
  const u = 4 * distance * distance;

  for (let i = 0; i < DARTS_ZONES.length; i++) {
    const zone = DARTS_ZONES[i]!;
    if (u >= zone.from && u < zone.to) {
      return { zone: zone.name, zoneIndex: i, multiplier: zone.multiplier };
    }
  }

  // u should always be in [0, 1), but guard against a float landing
  // exactly on/above 1 by falling back to the outermost ring rather than
  // throwing mid-round.
  const last = DARTS_ZONES[DARTS_ZONES.length - 1]!;
  return {
    zone: last.name,
    zoneIndex: DARTS_ZONES.length - 1,
    multiplier: last.multiplier,
  };
}

// --- Params / resolve ------------------------------------------------------

export const DartsParamsSchema = z.object({}).strict();

export type DartsParams = z.infer<typeof DartsParamsSchema>;

export type DartsOutcome = {
  distance: number;
  rotation: number;
  zone: DartsZone['name'];
  zoneIndex: number;
};

export function resolveDarts(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: DartsOutcome; multiplier: number; payout: number } {
  validateDartsParams(params);
  validateBetAmount('darts', betAmount);

  const { distance, rotation } = calculateDartThrow(generatorOpts);
  const { zone, zoneIndex, multiplier } = dartsZoneForDistance(distance);

  const payout = betAmount * multiplier;

  return {
    outcome: { distance, rotation, zone, zoneIndex },
    multiplier,
    payout,
  };
}

function validateDartsParams(params: unknown): DartsParams {
  const result = DartsParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('darts', result.error.message);
  }
  return result.data;
}
