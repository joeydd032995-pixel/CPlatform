'use client';

import type { RouletteBetType, RouletteParams } from '@/lib/params';
import {
  POCKET_TONE_CLASSES,
  pocketTone,
  placeRouletteBet,
  straightChipAmount,
  amountForBet,
  SPLIT_OVERLAYS,
  STREET_OVERLAYS,
  SIX_LINE_OVERLAYS,
  CORNER_OVERLAYS,
  ZONE_ORDINAL,
  ROULETTE_GRID_ROWS,
  ROULETTE_GRID_COLS,
  numberAt,
} from '@/lib/roulette-felt';
import { useRouletteChip } from '@/features/games/roulette/chip-context';
import { FeltChip } from '@/components/viz/FeltChip';
import { cn } from '@/lib/utils';

export function RouletteFelt({
  value,
  onChange,
  disabled = false,
}: {
  value: RouletteParams;
  onChange: (value: RouletteParams) => void;
  disabled?: boolean;
}) {
  const { selectedChip } = useRouletteChip();

  const placeBet = (betType: RouletteBetType, numbers: number[], zone?: number) => {
    if (disabled) return;
    onChange(placeRouletteBet(value, betType, numbers, selectedChip, zone));
  };

  return (
    <div
      className="w-full min-w-[32rem] rounded-xl bg-emerald-950/40 p-3 ring-1 ring-emerald-800/40"
      data-testid="roulette-felt"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Straight bet on 0"
        onClick={() => placeBet('straight', [0])}
        className={cn(
          'relative flex h-9 w-full items-center justify-center rounded text-sm font-bold',
          POCKET_TONE_CLASSES.green,
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        0
        <FeltChip amount={straightChipAmount(value.bets, 0)} />
      </button>

      <div className="mt-1 flex gap-1">
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
                      disabled={disabled}
                      aria-label={`Straight bet on ${n}`}
                      onClick={() => placeBet('straight', [n])}
                      className={cn(
                        'relative flex aspect-square items-center justify-center rounded text-xs font-bold',
                        POCKET_TONE_CLASSES[pocketTone(n)],
                        disabled && 'pointer-events-none opacity-60'
                      )}
                    >
                      {n}
                      <FeltChip amount={straightChipAmount(value.bets, n)} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0">
            {SPLIT_OVERLAYS.map((o) => (
              <button
                key={`split-${o.numbers.join('-')}`}
                type="button"
                disabled={disabled}
                aria-label={`Split bet on ${o.numbers.join(' and ')}`}
                onClick={() => placeBet('split', o.numbers)}
                className={cn(
                  'pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-400/90 text-[7px] font-bold text-yellow-950 ring-1 ring-yellow-200 hover:bg-yellow-300',
                  disabled && 'pointer-events-none opacity-60'
                )}
                style={{ left: `${o.left}%`, top: `${o.top}%` }}
              >
                {amountForBet(value.bets, 'split', o.numbers) || ''}
              </button>
            ))}
            {STREET_OVERLAYS.map((o) => (
              <button
                key={`street-${o.numbers.join('-')}`}
                type="button"
                disabled={disabled}
                aria-label={`Street bet on ${o.numbers.join(', ')}`}
                onClick={() => placeBet('street', o.numbers)}
                className={cn(
                  'pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-400/90 text-[7px] font-bold text-yellow-950 ring-1 ring-yellow-200 hover:bg-yellow-300',
                  disabled && 'pointer-events-none opacity-60'
                )}
                style={{ left: `${o.left}%`, top: `${o.top}%` }}
              >
                {amountForBet(value.bets, 'street', o.numbers) || ''}
              </button>
            ))}
            {SIX_LINE_OVERLAYS.map((o) => (
              <button
                key={`sixline-${o.numbers.join('-')}`}
                type="button"
                disabled={disabled}
                aria-label={`Six line bet on ${o.numbers.join(', ')}`}
                onClick={() => placeBet('six-line', o.numbers)}
                className={cn(
                  'pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-400/90 text-[7px] font-bold text-yellow-950 ring-1 ring-yellow-200 hover:bg-yellow-300',
                  disabled && 'pointer-events-none opacity-60'
                )}
                style={{ left: `${o.left}%`, top: `${o.top}%` }}
              >
                {amountForBet(value.bets, 'six-line', o.numbers) || ''}
              </button>
            ))}
            {CORNER_OVERLAYS.map((o) => (
              <button
                key={`corner-${o.numbers.join('-')}`}
                type="button"
                disabled={disabled}
                aria-label={`Corner bet on ${o.numbers.join(', ')}`}
                onClick={() => placeBet('corner', o.numbers)}
                className={cn(
                  'pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-400/90 text-[7px] font-bold text-yellow-950 ring-1 ring-yellow-200 hover:bg-yellow-300',
                  disabled && 'pointer-events-none opacity-60'
                )}
                style={{ left: `${o.left}%`, top: `${o.top}%` }}
              >
                {amountForBet(value.bets, 'corner', o.numbers) || ''}
              </button>
            ))}
          </div>
        </div>

        <div className="flex w-16 flex-col gap-0.5">
          {[0, 1, 2].map((zone) => (
            <button
              key={zone}
              type="button"
              disabled={disabled}
              aria-label={`${ZONE_ORDINAL[zone]} dozen bet`}
              onClick={() => placeBet('dozen', [], zone)}
              className={cn(
                'relative flex flex-1 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10',
                disabled && 'pointer-events-none opacity-60'
              )}
            >
              {ZONE_ORDINAL[zone]} 12
              <FeltChip amount={amountForBet(value.bets, 'dozen', [], zone)} className="right-1 top-1" />
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-1 grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${ROULETTE_GRID_COLS}, minmax(0, 1fr))` }}
      >
        {[0, 1, 2].map((zone) => (
          <button
            key={zone}
            type="button"
            disabled={disabled}
            aria-label={`Column ${zone + 1} bet (2:1)`}
            onClick={() => placeBet('column', [], zone)}
            className={cn(
              'relative flex h-8 items-center justify-center rounded bg-white/5 text-[10px] font-bold text-muted-foreground ring-1 ring-border hover:bg-white/10',
              disabled && 'pointer-events-none opacity-60'
            )}
          >
            2:1
            <FeltChip amount={amountForBet(value.bets, 'column', [], zone)} />
          </button>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-6 gap-0.5">
        {(
          [
            ['low', '1-18', '1 to 18 bet'],
            ['even', 'EVEN', 'Even bet'],
            ['red', 'RED', 'Red bet'],
            ['black', 'BLACK', 'Black bet'],
            ['odd', 'ODD', 'Odd bet'],
            ['high', '19-36', '19 to 36 bet'],
          ] as const
        ).map(([type, label, aria]) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            aria-label={aria}
            onClick={() => placeBet(type, [])}
            className={cn(
              'relative flex h-9 items-center justify-center rounded text-[10px] font-bold',
              type === 'red'
                ? POCKET_TONE_CLASSES.red
                : type === 'black'
                  ? POCKET_TONE_CLASSES.black
                  : 'bg-white/5 text-muted-foreground ring-1 ring-border hover:bg-white/10',
              disabled && 'pointer-events-none opacity-60'
            )}
          >
            {label}
            <FeltChip amount={amountForBet(value.bets, type, [])} />
          </button>
        ))}
      </div>
    </div>
  );
}