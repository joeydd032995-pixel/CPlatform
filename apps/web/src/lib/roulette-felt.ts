import type { RouletteBetType, RouletteParams, RouletteSingleBet } from '@/lib/params';
import {
  ROULETTE_SPLITS,
  ROULETTE_STREETS,
  ROULETTE_CORNERS,
  ROULETTE_SIX_LINES,
  ROULETTE_GRID_ROWS,
  ROULETTE_GRID_COLS,
  REAL_RED_NUMBERS,
  numberAt,
} from '@/lib/params';
import { betDedupeKey } from '@/lib/roulette-bet-label';

export const CHIP_PRESETS = [1, 5, 25, 100, 500] as const;

export const ZONE_ORDINAL = ['1st', '2nd', '3rd'] as const;

export function pocketTone(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return REAL_RED_NUMBERS.has(n) ? 'red' : 'black';
}

export const POCKET_TONE_CLASSES: Record<'red' | 'black' | 'green', string> = {
  red: 'bg-red-600 hover:bg-red-500 text-white',
  black: 'bg-slate-900 hover:bg-slate-800 text-white',
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white',
};

export const CELL_W = 100 / ROULETTE_GRID_COLS;
export const CELL_H = 100 / ROULETTE_GRID_ROWS;

export type FeltOverlay = { numbers: number[]; left: number; top: number };

function rowColOf(n: number): { row: number; col: number } {
  return { row: Math.floor((n - 1) / ROULETTE_GRID_COLS), col: (n - 1) % ROULETTE_GRID_COLS };
}

export const SPLIT_OVERLAYS: FeltOverlay[] = ROULETTE_SPLITS.map((numbers) => {
  const a = numbers[0]!;
  const b = numbers[1]!;
  const { row, col } = rowColOf(a);
  const horizontal = b - a === 1;
  const left = horizontal ? (col + 1) * CELL_W : (col + 0.5) * CELL_W;
  const top = horizontal ? (row + 0.5) * CELL_H : (row + 1) * CELL_H;
  return { numbers, left, top };
});

export const STREET_OVERLAYS: FeltOverlay[] = ROULETTE_STREETS.map((numbers) => {
  const { row } = rowColOf(numbers[0]!);
  return { numbers, left: 1, top: (row + 0.5) * CELL_H };
});

export const SIX_LINE_OVERLAYS: FeltOverlay[] = ROULETTE_SIX_LINES.map((numbers) => {
  const { row } = rowColOf(numbers[0]!);
  return { numbers, left: 1, top: (row + 1) * CELL_H };
});

export const CORNER_OVERLAYS: FeltOverlay[] = ROULETTE_CORNERS.map((numbers) => {
  const { row, col } = rowColOf(numbers[0]!);
  return { numbers, left: (col + 1) * CELL_W, top: (row + 1) * CELL_H };
});

export function betAmountByKey(bets: RouletteSingleBet[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const bet of bets) {
    const key = betDedupeKey(bet.betType, bet.numbers, bet.zone);
    map.set(key, (map.get(key) ?? 0) + bet.amount);
  }
  return map;
}

export function amountForBet(
  bets: RouletteSingleBet[],
  betType: RouletteBetType,
  numbers: number[] = [],
  zone?: number
): number {
  return betAmountByKey(bets).get(betDedupeKey(betType, numbers, zone)) ?? 0;
}

export function straightChipAmount(bets: RouletteSingleBet[], n: number): number {
  return amountForBet(bets, 'straight', [n]);
}

export function placeRouletteBet(
  value: RouletteParams,
  betType: RouletteBetType,
  numbers: number[],
  chipAmount: number,
  zone?: number
): RouletteParams {
  const key = betDedupeKey(betType, numbers, zone);
  const existingIndex = value.bets.findIndex(
    (b) => betDedupeKey(b.betType, b.numbers, b.zone) === key
  );
  if (existingIndex >= 0) {
    const next = [...value.bets];
    const existing = next[existingIndex]!;
    next[existingIndex] = { ...existing, amount: existing.amount + chipAmount };
    return { bets: next };
  }
  const bet: RouletteSingleBet = { betType, numbers, zone, amount: chipAmount };
  return { bets: [...value.bets, bet] };
}

export function removeRouletteBet(value: RouletteParams, index: number): RouletteParams {
  return { bets: value.bets.filter((_, i) => i !== index) };
}

export function clearRouletteBets(): RouletteParams {
  return { bets: [] };
}

export { ROULETTE_GRID_ROWS, ROULETTE_GRID_COLS, numberAt };