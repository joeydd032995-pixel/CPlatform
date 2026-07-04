'use client';

import { useState } from 'react';
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
import { describeRouletteBet, betDedupeKey } from '@/lib/roulette-bet-label';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RouletteWheelFace } from '@/components/viz/RouletteWheel';

const CHIP_PRESETS = [1, 5, 25, 100, 500] as const;

function pocketTone(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return REAL_RED_NUMBERS.has(n) ? 'red' : 'black';
}

const TONE_CLASSES: Record<'red' | 'black' | 'green', string> = {
  red: 'bg-red-600 hover:bg-red-500 text-white',
  black: 'bg-slate-900 hover:bg-slate-800 text-white',
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white',
};

// --- Overlay hit-target geometry -------------------------------------------
// Positions are purely presentational math over the already-existing
// adjacency arrays (ROULETTE_SPLITS/STREETS/CORNERS/SIX_LINES) -- no new
// adjacency logic is invented here, only percentage placement within the
// number grid's bounding box, derived by inverting numberAt(row, col).

const CELL_W = 100 / ROULETTE_GRID_COLS;
const CELL_H = 100 / ROULETTE_GRID_ROWS;

function rowColOf(n: number): { row: number; col: number } {
  return { row: Math.floor((n - 1) / ROULETTE_GRID_COLS), col: (n - 1) % ROULETTE_GRID_COLS };
}

type Overlay = { numbers: number[]; left: number; top: number };

// These arrays come from lib/params.ts's own generated adjacency tables --
// every entry is guaranteed to have the fixed length its bet type requires
// (2 for splits, 3 for streets, 6 for six-lines, 4 for corners), so the
// non-null assertions below are safe despite noUncheckedIndexedAccess.
const SPLIT_OVERLAYS: Overlay[] = ROULETTE_SPLITS.map((numbers) => {
  const a = numbers[0]!;
  const b = numbers[1]!;
  const { row, col } = rowColOf(a);
  const horizontal = b - a === 1;
  const left = horizontal ? (col + 1) * CELL_W : (col + 0.5) * CELL_W;
  const top = horizontal ? (row + 0.5) * CELL_H : (row + 1) * CELL_H;
  return { numbers, left, top };
});

const STREET_OVERLAYS: Overlay[] = ROULETTE_STREETS.map((numbers) => {
  const { row } = rowColOf(numbers[0]!);
  return { numbers, left: 1, top: (row + 0.5) * CELL_H };
});

const SIX_LINE_OVERLAYS: Overlay[] = ROULETTE_SIX_LINES.map((numbers) => {
  const { row } = rowColOf(numbers[0]!);
  return { numbers, left: 1, top: (row + 1) * CELL_H };
});

const CORNER_OVERLAYS: Overlay[] = ROULETTE_CORNERS.map((numbers) => {
  const { row, col } = rowColOf(numbers[0]!);
  return { numbers, left: (col + 1) * CELL_W, top: (row + 1) * CELL_H };
});

const ZONE_ORDINAL = ['1st', '2nd', '3rd'] as const;

// Purely decorative pre-bet preview, following the established Idle<Thing>
// convention (private, non-exported, aria-hidden, derives purely from
// nothing / current state, rendered after the interactive controls). Reuses
// the same presentational RouletteWheelFace the live spinning wheel renders,
// just without any rotation/animation wrapper.
function IdleWheel() {
  return (
    <div className="flex flex-col items-center gap-2 pt-2" aria-hidden="true">
      <RouletteWheelFace size={180} />
    </div>
  );
}

export function RouletteParamsForm({
  value,
  onChange,
}: {
  value: RouletteParams;
  onChange: (value: RouletteParams) => void;
}) {
  const [selectedChip, setSelectedChip] = useState<number>(5);
  const [customChipText, setCustomChipText] = useState('');

  const placeBet = (betType: RouletteBetType, numbers: number[], zone?: number) => {
    const key = betDedupeKey(betType, numbers, zone);
    const existingIndex = value.bets.findIndex(
      (b) => betDedupeKey(b.betType, b.numbers, b.zone) === key
    );
    if (existingIndex >= 0) {
      const next = [...value.bets];
      const existing = next[existingIndex]!;
      next[existingIndex] = { ...existing, amount: existing.amount + selectedChip };
      onChange({ bets: next });
    } else {
      const bet: RouletteSingleBet = { betType, numbers, zone, amount: selectedChip };
      onChange({ bets: [...value.bets, bet] });
    }
  };

  const removeBet = (index: number) => {
    onChange({ bets: value.bets.filter((_, i) => i !== index) });
  };

  const clearAll = () => onChange({ bets: [] });

  const total = value.bets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Chip denomination selector */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-bold tracking-widest text-muted-foreground">
          CHIP VALUE
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={CHIP_PRESETS.includes(selectedChip as (typeof CHIP_PRESETS)[number]) ? String(selectedChip) : ''}
            onValueChange={(v) => {
              if (!v) return;
              setSelectedChip(Number(v));
              setCustomChipText('');
            }}
          >
            {CHIP_PRESETS.map((chip) => (
              <ToggleGroupItem key={chip} value={String(chip)} aria-label={`Chip ${chip}`}>
                {chip}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Custom"
            value={customChipText}
            onChange={(e) => {
              const text = e.target.value;
              setCustomChipText(text);
              const n = Number(text);
              if (Number.isFinite(n) && n > 0) setSelectedChip(n);
            }}
            className="h-9 w-24"
          />
        </div>
      </div>

      {/* Felt */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label="Straight bet on 0"
          onClick={() => placeBet('straight', [0])}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded text-sm font-bold',
            TONE_CLASSES.green
          )}
        >
          0
        </button>

        <div className="flex gap-1">
          <div className="relative flex-1">
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${ROULETTE_GRID_COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: ROULETTE_GRID_ROWS }, (_, row) => (
                <div key={row} className="contents">
                  {Array.from({ length: ROULETTE_GRID_COLS }, (_, col) => {
                    const n = numberAt(row, col);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Straight bet on ${n}`}
                        onClick={() => placeBet('straight', [n])}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded text-xs font-bold',
                          TONE_CLASSES[pocketTone(n)]
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Split/street/corner/six-line hit-target overlay */}
            <div className="pointer-events-none absolute inset-0">
              {SPLIT_OVERLAYS.map((o) => (
                <button
                  key={`split-${o.numbers.join('-')}`}
                  type="button"
                  aria-label={`Split bet on ${o.numbers.join(' and ')}`}
                  onClick={() => placeBet('split', o.numbers)}
                  className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/70 ring-1 ring-yellow-200 hover:bg-yellow-300"
                  style={{ left: `${o.left}%`, top: `${o.top}%` }}
                />
              ))}
              {STREET_OVERLAYS.map((o) => (
                <button
                  key={`street-${o.numbers.join('-')}`}
                  type="button"
                  aria-label={`Street bet on ${o.numbers.join(', ')}`}
                  onClick={() => placeBet('street', o.numbers)}
                  className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/70 ring-1 ring-yellow-200 hover:bg-yellow-300"
                  style={{ left: `${o.left}%`, top: `${o.top}%` }}
                />
              ))}
              {SIX_LINE_OVERLAYS.map((o) => (
                <button
                  key={`sixline-${o.numbers.join('-')}`}
                  type="button"
                  aria-label={`Six line bet on ${o.numbers.join(', ')}`}
                  onClick={() => placeBet('six-line', o.numbers)}
                  className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/70 ring-1 ring-yellow-200 hover:bg-yellow-300"
                  style={{ left: `${o.left}%`, top: `${o.top}%` }}
                />
              ))}
              {CORNER_OVERLAYS.map((o) => (
                <button
                  key={`corner-${o.numbers.join('-')}`}
                  type="button"
                  aria-label={`Corner bet on ${o.numbers.join(', ')}`}
                  onClick={() => placeBet('corner', o.numbers)}
                  className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/70 ring-1 ring-yellow-200 hover:bg-yellow-300"
                  style={{ left: `${o.left}%`, top: `${o.top}%` }}
                />
              ))}
            </div>
          </div>

          {/* Dozen boxes (right of grid, spanning matching thirds of the
              12-row grid via equal flex-1 stretch). */}
          <div className="flex w-16 flex-col gap-0.5">
            {[0, 1, 2].map((zone) => (
              <button
                key={zone}
                type="button"
                aria-label={`${ZONE_ORDINAL[zone]} dozen bet`}
                onClick={() => placeBet('dozen', [], zone)}
                className="flex flex-1 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
              >
                {ZONE_ORDINAL[zone]} 12
              </button>
            ))}
          </div>
        </div>

        {/* Column boxes (below the grid, matching each column's x-position) */}
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${ROULETTE_GRID_COLS}, minmax(0, 1fr))` }}
        >
          {[0, 1, 2].map((zone) => (
            <button
              key={zone}
              type="button"
              aria-label={`Column ${zone + 1} bet (2:1)`}
              onClick={() => placeBet('column', [], zone)}
              className="flex h-8 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
            >
              2:1
            </button>
          ))}
        </div>

        {/* Outside boxes: low/even/red/black/odd/high */}
        <div className="grid grid-cols-6 gap-0.5">
          <button
            type="button"
            aria-label="1 to 18 bet"
            onClick={() => placeBet('low', [])}
            className="flex h-9 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
          >
            1-18
          </button>
          <button
            type="button"
            aria-label="Even bet"
            onClick={() => placeBet('even', [])}
            className="flex h-9 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
          >
            EVEN
          </button>
          <button
            type="button"
            aria-label="Red bet"
            onClick={() => placeBet('red', [])}
            className={cn('flex h-9 items-center justify-center rounded text-[10px] font-bold', TONE_CLASSES.red)}
          >
            RED
          </button>
          <button
            type="button"
            aria-label="Black bet"
            onClick={() => placeBet('black', [])}
            className={cn('flex h-9 items-center justify-center rounded text-[10px] font-bold', TONE_CLASSES.black)}
          >
            BLACK
          </button>
          <button
            type="button"
            aria-label="Odd bet"
            onClick={() => placeBet('odd', [])}
            className="flex h-9 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
          >
            ODD
          </button>
          <button
            type="button"
            aria-label="19 to 36 bet"
            onClick={() => placeBet('high', [])}
            className="flex h-9 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10"
          >
            19-36
          </button>
        </div>
      </div>

      {/* Current bets summary */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold tracking-widest text-muted-foreground">
            CURRENT BETS
          </Label>
          {value.bets.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs">
              Clear all
            </Button>
          )}
        </div>
        {value.bets.length === 0 ? (
          <div className="text-xs text-muted-foreground">No bets placed yet.</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {value.bets.map((bet, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded bg-background px-2 py-1 text-xs ring-1 ring-border"
              >
                <span>{describeRouletteBet(bet.betType, bet.numbers, bet.zone)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{bet.amount}</span>
                  <button
                    type="button"
                    aria-label={`Remove bet ${index + 1}`}
                    onClick={() => removeBet(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-border pt-1 text-xs font-semibold">
          <span>Total</span>
          <span className="font-mono">{total}</span>
        </div>
      </div>

      <IdleWheel />
    </div>
  );
}
