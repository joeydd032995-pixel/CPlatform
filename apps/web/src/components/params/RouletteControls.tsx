'use client';

import type { RouletteParams } from '@/lib/params';
import { describeRouletteBet } from '@/lib/roulette-bet-label';
import {
  clearRouletteBets,
  removeRouletteBet,
  CHIP_PRESETS,
} from '@/lib/roulette-felt';
import { useRouletteChip } from '@/features/games/roulette/chip-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function RouletteControls({
  value,
  onChange,
  disabled = false,
}: {
  value: RouletteParams;
  onChange: (value: RouletteParams) => void;
  disabled?: boolean;
}) {
  const { selectedChip, setSelectedChip, customChipText, setCustomChipText } = useRouletteChip();
  const total = value.bets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className={cn('flex flex-col gap-4', disabled && 'pointer-events-none opacity-60')}>
      <div
        className={cn(
          'flex flex-col gap-2 rounded-xl border border-border/40 bg-background/40 p-3',
          'lg:static lg:border-0 lg:bg-transparent lg:p-0',
          'sticky top-0 z-10 backdrop-blur-sm sm:backdrop-blur-none'
        )}
      >
        <Label className="text-[10px] font-bold tracking-widest text-muted-foreground">
          CHIP VALUE
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={
              CHIP_PRESETS.includes(selectedChip as (typeof CHIP_PRESETS)[number])
                ? String(selectedChip)
                : ''
            }
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
        <p className="text-xs text-muted-foreground">
          Tap the felt to place chips — selected value:{' '}
          <span className="font-mono font-semibold tabular-nums">{selectedChip}</span>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold tracking-widest text-muted-foreground">
            CURRENT BETS
          </Label>
          {value.bets.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(clearRouletteBets())}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
        {value.bets.length === 0 ? (
          <div className="text-xs text-muted-foreground">Place chips on the table to bet.</div>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {value.bets.map((bet, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded bg-background px-2 py-1 text-xs ring-1 ring-border"
              >
                <span className="truncate pr-2">
                  {describeRouletteBet(bet.betType, bet.numbers, bet.zone)}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono tabular-nums">{bet.amount}</span>
                  <button
                    type="button"
                    aria-label={`Remove bet ${index + 1}`}
                    onClick={() => onChange(removeRouletteBet(value, index))}
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
          <span>Total stake</span>
          <span className="font-mono tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}