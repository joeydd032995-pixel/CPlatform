'use client';

import type { MinesParams } from '@/lib/params';
import { MINES_GAME_TILES_COUNT } from '@/lib/params';

export function MinesParamsForm({
  value,
  onChange,
}: {
  value: MinesParams;
  onChange: (value: MinesParams) => void;
}) {
  const maxPicks = MINES_GAME_TILES_COUNT - value.mines;

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Mines (1-24)
        <input
          type="number"
          min={1}
          max={24}
          value={value.mines}
          onChange={(e) => {
            const mines = Number(e.target.value);
            const clampedMax = MINES_GAME_TILES_COUNT - mines;
            onChange({
              mines,
              picks: Math.min(value.picks, Math.max(clampedMax, 0)),
            });
          }}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Picks (0-{maxPicks})
        <input
          type="number"
          min={0}
          max={maxPicks}
          value={value.picks}
          onChange={(e) =>
            onChange({ ...value, picks: Math.min(Number(e.target.value), maxPicks) })
          }
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        />
      </label>
    </div>
  );
}
