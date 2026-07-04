'use client';

import type { MinesParams } from '@/lib/params';
import { MINES_GAME_TILES_COUNT } from '@/lib/params';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MinesParamsForm({
  value,
  onChange,
}: {
  value: MinesParams;
  onChange: (value: MinesParams) => void;
}) {
  const maxPicks = MINES_GAME_TILES_COUNT - value.mines;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-widest text-muted-foreground">
          <span>MINES</span>
          <span>{value.mines}</span>
        </div>
        <Slider
          min={1}
          max={24}
          step={1}
          value={[value.mines]}
          onValueChange={(vals) => {
            const mines = vals[0] ?? value.mines;
            const clampedMax = MINES_GAME_TILES_COUNT - mines;
            onChange({ mines, picks: Math.min(value.picks, Math.max(clampedMax, 0)) });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="mines-picks" className="text-sm text-muted-foreground">
          Picks (0-{maxPicks})
        </Label>
        <Input
          id="mines-picks"
          type="number"
          min={0}
          max={maxPicks}
          value={value.picks}
          onChange={(e) =>
            onChange({ ...value, picks: Math.min(Math.max(Number(e.target.value), 0), maxPicks) })
          }
        />
      </div>
    </div>
  );
}
