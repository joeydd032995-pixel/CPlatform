'use client';

import type { KenoParams } from '@/lib/params';
import { KENO_GAME_TILES_COUNT, KENO_GAME_TILES_HIT_COUNT } from '@/lib/params';
import { SecondaryButton } from '@/components/games/GameShell';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const RISKS: KenoParams['risk'][] = ['classic', 'low', 'medium', 'high'];

export function KenoParamsForm({
  value,
  onChange,
}: {
  value: KenoParams;
  onChange: (value: KenoParams) => void;
}) {
  const toggleTile = (tile: number) => {
    const isPicked = value.picks.includes(tile);
    if (isPicked) {
      onChange({ ...value, picks: value.picks.filter((p) => p !== tile) });
      return;
    }
    if (value.picks.length >= KENO_GAME_TILES_HIT_COUNT) return;
    onChange({ ...value, picks: [...value.picks, tile].sort((a, b) => a - b) });
  };

  const autoPick = () => {
    const picks = new Set<number>();
    while (picks.size < KENO_GAME_TILES_HIT_COUNT) {
      picks.add(Math.floor(Math.random() * KENO_GAME_TILES_COUNT) + 1);
    }
    onChange({ ...value, picks: [...picks].sort((a, b) => a - b) });
  };

  const tiles = Array.from({ length: KENO_GAME_TILES_COUNT }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keno-risk" className="text-sm text-muted-foreground">
          Risk
        </Label>
        <Select
          value={value.risk}
          onValueChange={(risk) => onChange({ ...value, risk: risk as KenoParams['risk'] })}
        >
          <SelectTrigger id="keno-risk" className="w-full" data-testid="keno-risk-select">
            <SelectValue placeholder="Select risk" />
          </SelectTrigger>
          <SelectContent>
            {RISKS.map((risk) => (
              <SelectItem key={risk} value={risk}>
                {risk}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton onClick={autoPick}>AUTO PICK</SecondaryButton>
        <SecondaryButton onClick={() => onChange({ ...value, picks: [] })}>
          CLEAR TABLE
        </SecondaryButton>
      </div>

      <div className="text-sm text-muted-foreground">
        Picks ({value.picks.length}/{KENO_GAME_TILES_HIT_COUNT})
      </div>
      <div className="grid grid-cols-8 gap-1.5" data-testid="keno-pick-grid">
        {tiles.map((tile) => {
          const isPicked = value.picks.includes(tile);
          const disabled = !isPicked && value.picks.length >= KENO_GAME_TILES_HIT_COUNT;
          return (
            <button
              key={tile}
              type="button"
              data-testid={`keno-pick-${tile}`}
              disabled={disabled}
              onClick={() => toggleTile(tile)}
              className={cn(
                'flex aspect-square items-center justify-center rounded text-xs font-semibold ring-1',
                isPicked
                  ? 'bg-fuchsia-500 text-white ring-fuchsia-400'
                  : disabled
                    ? 'cursor-not-allowed bg-muted/40 text-muted-foreground/50 ring-border'
                    : 'bg-white/5 text-muted-foreground ring-white/5 hover:bg-white/10'
              )}
            >
              {tile}
            </button>
          );
        })}
      </div>
    </div>
  );
}