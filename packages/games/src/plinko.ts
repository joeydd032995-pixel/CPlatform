// Ported from .claude/skills/game-logic-engineer/references/games/plinko.ts
// verbatim (including all multiplier table values) — only the RNG
// import/naming has been fixed to match the real @cplatform/core-rng
// package.
//
// Note: Plinko's shipped multiplier tables already have the house edge
// baked in (several entries are below 1.0, e.g. 0.95/0.17) — resolve()
// must NOT run the looked-up multiplier through applyHouseEdge again.

import { z } from 'zod';
import { createFloatGenerator, type GeneratorOptions } from '@cplatform/core-rng';
import { InvalidBetParamsError } from '@cplatform/shared';

export enum PlinkoBallMove {
  Left = 'left',
  Right = 'right',
}

export type PlinkoBallPath = PlinkoBallMove[];

export type PlinkoRNGOptions = GeneratorOptions & {
  rows: number;
};

export const calculatePlinkoBallPath = ({
  rows,
  ...rngOptions
}: PlinkoRNGOptions): PlinkoBallPath => {
  const floatsRng = createFloatGenerator(rngOptions);

  return Array(rows)
    .fill(0)
    .map(() => {
      const float = floatsRng.next().value;
      const moveValue = Math.floor(float * 2);
      return moveValue === 0 ? PlinkoBallMove.Left : PlinkoBallMove.Right;
    });
};

export enum PlinkoRisk {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export type PlinkoMultipliersTable = readonly number[];

export const getPlinkoMultipliersTable = ({
  risk,
  rows,
}: {
  risk: PlinkoRisk;
  rows: number;
}): PlinkoMultipliersTable => {
  const rowsToMultipliers = {
    8: {
      [PlinkoRisk.Low]: [5.8, 2.1, 1.1, 0.95, 0.5, 0.95, 1.1, 2.1, 5.8],
      [PlinkoRisk.Medium]: [13, 3, 1.29, 0.68, 0.37, 0.68, 1.29, 3, 13],
      [PlinkoRisk.High]: [29, 4, 1.5, 0.27, 0.17, 0.27, 1.5, 4, 29],
    },
    9: {
      [PlinkoRisk.Low]: [7, 2, 1.6, 0.95, 0.68, 0.68, 0.95, 1.6, 2, 7],
      [PlinkoRisk.Medium]: [19, 4, 1.7, 0.88, 0.46, 0.46, 0.88, 1.7, 4, 19],
      [PlinkoRisk.High]: [44, 7, 2, 0.57, 0.17, 0.17, 0.57, 2, 7, 44],
    },
    10: {
      [PlinkoRisk.Low]: [9, 3, 1.4, 1.1, 0.95, 0.5, 0.95, 1.1, 1.4, 3, 9],
      [PlinkoRisk.Medium]: [23, 5, 2, 1.4, 0.59, 0.33, 0.59, 1.4, 2, 5, 23],
      [PlinkoRisk.High]: [77, 10, 3, 0.9, 0.25, 0.19, 0.25, 0.9, 3, 10, 77],
    },
    11: {
      [PlinkoRisk.Low]: [9, 3, 1.9, 1.3, 0.95, 0.69, 0.69, 0.95, 1.3, 1.9, 3, 9],
      [PlinkoRisk.Medium]: [26, 6, 3, 1.8, 0.63, 0.5, 0.5, 0.63, 1.8, 3, 6, 26],
      [PlinkoRisk.High]: [
        122, 14.2, 5.2, 1.4, 0.32, 0.2, 0.2, 0.32, 1.4, 5.2, 14.2, 122,
      ],
    },
    12: {
      [PlinkoRisk.Low]: [
        11, 3, 1.6, 1.4, 1.1, 0.97, 0.46, 0.97, 1.1, 1.4, 1.6, 3, 11,
      ],
      [PlinkoRisk.Medium]: [
        34, 11, 4, 2, 1.1, 0.54, 0.31, 0.54, 1.1, 2, 4, 11, 34,
      ],
      [PlinkoRisk.High]: [
        174, 24, 8.1, 2, 0.7, 0.18, 0.13, 0.18, 0.7, 2, 8.1, 24, 174,
      ],
    },
    13: {
      [PlinkoRisk.Low]: [
        8.4, 4, 3, 1.9, 1.25, 0.78, 0.72, 0.72, 0.78, 1.25, 1.9, 3, 4, 8.4,
      ],
      [PlinkoRisk.Medium]: [
        44, 14, 6, 3, 1.3, 0.69, 0.35, 0.35, 0.69, 1.3, 3, 6, 14, 44,
      ],
      [PlinkoRisk.High]: [
        274, 37, 11, 4, 1, 0.2, 0.14, 0.14, 0.2, 1, 4, 11, 37, 274,
      ],
    },
    14: {
      [PlinkoRisk.Low]: [
        22, 4, 1.9, 1.4, 1.3, 1.1, 0.95, 0.48, 0.95, 1.1, 1.3, 1.4, 1.9, 4, 22,
      ],
      [PlinkoRisk.Medium]: [
        60, 16, 7.2, 4, 2, 1, 0.4, 0.2, 0.4, 1, 2, 4, 7.2, 16, 60,
      ],
      [PlinkoRisk.High]: [
        429, 56, 18, 5, 1.9, 0.3, 0.17, 0.15, 0.17, 0.3, 1.9, 5, 18, 56, 429,
      ],
    },
    15: {
      [PlinkoRisk.Low]: [
        16, 8, 3, 2.15, 1.2, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.2, 2.15, 3, 8, 16,
      ],
      [PlinkoRisk.Medium]: [
        96, 18, 11, 5, 3, 1.3, 0.47, 0.27, 0.27, 0.47, 1.3, 3, 5, 11, 18, 96,
      ],
      [PlinkoRisk.High]: [
        643, 83, 27, 8, 3, 0.5, 0.18, 0.16, 0.16, 0.18, 0.5, 3, 8, 27, 83, 643,
      ],
    },
    16: {
      [PlinkoRisk.Low]: [
        18, 6, 1.8, 1.4, 1.3, 1.2, 1.1, 0.99, 0.45, 0.99, 1.1, 1.2, 1.3, 1.4,
        1.8, 6, 18,
      ],
      [PlinkoRisk.Medium]: [
        120, 41, 10.3, 5.3, 2.75, 1.3, 1.2, 0.4, 0.3, 0.4, 1.2, 1.3, 2.75, 5.3,
        10.3, 41, 120,
      ],
      [PlinkoRisk.High]: [
        1100, 146, 30.3, 10.5, 2.7, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 2.7, 10.5,
        30.3, 146, 1100,
      ],
    },
  } as const;

  const table = rowsToMultipliers[rows as keyof typeof rowsToMultipliers];
  if (table == null) {
    throw new Error(`Unsupported Plinko rows: ${rows} (expected 8-16)`);
  }
  return table[risk];
};

export const plinkoBallPathToMultiplierIndex = ({
  path,
}: {
  path: PlinkoBallPath;
}): number => path.filter((move) => move === PlinkoBallMove.Right).length;

export const calculatePlinkoMultiplier = ({
  risk,
  rows,
  multiplierIndex,
}: {
  risk: PlinkoRisk;
  rows: number;
  multiplierIndex: number;
}): number => {
  const multipliersTable = getPlinkoMultipliersTable({ risk, rows });
  const multiplier = multipliersTable[multiplierIndex];

  if (multiplier == null) {
    throw new Error(
      `Could not calculate multiplier for risk(${risk}), rows(${rows}) & multiplierIndex(${multiplierIndex})!`
    );
  }

  return multiplier;
};

export const toPlinkoRisk = (input: string): PlinkoRisk => {
  switch (input.toLowerCase()) {
    case 'low':
      return PlinkoRisk.Low;
    case 'medium':
      return PlinkoRisk.Medium;
    case 'high':
      return PlinkoRisk.High;
    default:
      throw new Error(`Invalid risk level: ${input}`);
  }
};

export const PlinkoParamsSchema = z.object({
  rows: z.number().int().min(8).max(16),
  risk: z.enum(['low', 'medium', 'high']),
});

export type PlinkoParams = z.infer<typeof PlinkoParamsSchema>;

export type PlinkoOutcome = {
  path: PlinkoBallPath;
  multiplierIndex: number;
};

export function resolvePlinko(
  generatorOpts: GeneratorOptions,
  params: unknown,
  betAmount: number
): { outcome: PlinkoOutcome; multiplier: number; payout: number } {
  const parsed = validatePlinkoParams(params);
  const risk = toPlinkoRisk(parsed.risk);

  const path = calculatePlinkoBallPath({ ...generatorOpts, rows: parsed.rows });
  const multiplierIndex = plinkoBallPathToMultiplierIndex({ path });
  const multiplier = calculatePlinkoMultiplier({
    risk,
    rows: parsed.rows,
    multiplierIndex,
  });

  const payout = betAmount * multiplier;

  return {
    outcome: { path, multiplierIndex },
    multiplier,
    payout,
  };
}

function validatePlinkoParams(params: unknown): PlinkoParams {
  const result = PlinkoParamsSchema.safeParse(params);
  if (!result.success) {
    throw new InvalidBetParamsError('plinko', result.error.message);
  }
  return result.data;
}
