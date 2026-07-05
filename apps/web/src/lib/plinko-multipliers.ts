// Plinko payout table mirrored from packages/games/src/plinko.ts for browser
// display only — @cplatform/games cannot ship in the Next.js client bundle.

import type { PlinkoParams } from '@/lib/params';

type PlinkoRisk = PlinkoParams['risk'];

const ROWS_TO_MULTIPLIERS = {
  8: {
    low: [5.8, 2.1, 1.1, 0.95, 0.5, 0.95, 1.1, 2.1, 5.8],
    medium: [13, 3, 1.29, 0.68, 0.37, 0.68, 1.29, 3, 13],
    high: [29, 4, 1.5, 0.27, 0.17, 0.27, 1.5, 4, 29],
  },
  9: {
    low: [7, 2, 1.6, 0.95, 0.68, 0.68, 0.95, 1.6, 2, 7],
    medium: [19, 4, 1.7, 0.88, 0.46, 0.46, 0.88, 1.7, 4, 19],
    high: [44, 7, 2, 0.57, 0.17, 0.17, 0.57, 2, 7, 44],
  },
  10: {
    low: [9, 3, 1.4, 1.1, 0.95, 0.5, 0.95, 1.1, 1.4, 3, 9],
    medium: [23, 5, 2, 1.4, 0.59, 0.33, 0.59, 1.4, 2, 5, 23],
    high: [77, 10, 3, 0.9, 0.25, 0.19, 0.25, 0.9, 3, 10, 77],
  },
  11: {
    low: [9, 3, 1.9, 1.3, 0.95, 0.69, 0.69, 0.95, 1.3, 1.9, 3, 9],
    medium: [26, 6, 3, 1.8, 0.63, 0.5, 0.5, 0.63, 1.8, 3, 6, 26],
    high: [122, 14.2, 5.2, 1.4, 0.32, 0.2, 0.2, 0.32, 1.4, 5.2, 14.2, 122],
  },
  12: {
    low: [11, 3, 1.6, 1.4, 1.1, 0.97, 0.46, 0.97, 1.1, 1.4, 1.6, 3, 11],
    medium: [34, 11, 4, 2, 1.1, 0.54, 0.31, 0.54, 1.1, 2, 4, 11, 34],
    high: [174, 24, 8.1, 2, 0.7, 0.18, 0.13, 0.18, 0.7, 2, 8.1, 24, 174],
  },
  13: {
    low: [8.4, 4, 3, 1.9, 1.25, 0.78, 0.72, 0.72, 0.78, 1.25, 1.9, 3, 4, 8.4],
    medium: [44, 14, 6, 3, 1.3, 0.69, 0.35, 0.35, 0.69, 1.3, 3, 6, 14, 44],
    high: [274, 37, 11, 4, 1, 0.2, 0.14, 0.14, 0.2, 1, 4, 11, 37, 274],
  },
  14: {
    low: [22, 4, 1.9, 1.4, 1.3, 1.1, 0.95, 0.48, 0.95, 1.1, 1.3, 1.4, 1.9, 4, 22],
    medium: [60, 16, 7.2, 4, 2, 1, 0.4, 0.2, 0.4, 1, 2, 4, 7.2, 16, 60],
    high: [429, 56, 18, 5, 1.9, 0.3, 0.17, 0.15, 0.17, 0.3, 1.9, 5, 18, 56, 429],
  },
  15: {
    low: [16, 8, 3, 2.15, 1.2, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.2, 2.15, 3, 8, 16],
    medium: [96, 18, 11, 5, 3, 1.3, 0.47, 0.27, 0.27, 0.47, 1.3, 3, 5, 11, 18, 96],
    high: [643, 83, 27, 8, 3, 0.5, 0.18, 0.16, 0.16, 0.18, 0.5, 3, 8, 27, 83, 643],
  },
  16: {
    low: [18, 6, 1.8, 1.4, 1.3, 1.2, 1.1, 0.99, 0.45, 0.99, 1.1, 1.2, 1.3, 1.4, 1.8, 6, 18],
    medium: [120, 41, 10.3, 5.3, 2.75, 1.3, 1.2, 0.4, 0.3, 0.4, 1.2, 1.3, 2.75, 5.3, 10.3, 41, 120],
    high: [1100, 146, 30.3, 10.5, 2.7, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 2.7, 10.5, 30.3, 146, 1100],
  },
} as const satisfies Record<number, Record<PlinkoRisk, readonly number[]>>;

export function getPlinkoMultipliersTable({
  risk,
  rows,
}: {
  risk: PlinkoRisk;
  rows: number;
}): readonly number[] {
  const table = ROWS_TO_MULTIPLIERS[rows as keyof typeof ROWS_TO_MULTIPLIERS];
  if (table == null) {
    throw new Error(`Unsupported Plinko rows: ${rows} (expected 8-16)`);
  }
  return table[risk];
}

export function formatPlinkoMultiplier(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) {
    const rounded = value.toFixed(1);
    return rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
  }
  if (value >= 1) {
    const text = value.toFixed(2);
    return text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return value.toFixed(2);
}