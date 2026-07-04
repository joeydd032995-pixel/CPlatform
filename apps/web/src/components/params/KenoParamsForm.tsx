'use client';

import type { KenoParams } from '@/lib/params';
import { KENO_GAME_TILES_COUNT, KENO_GAME_TILES_HIT_COUNT } from '@/lib/params';

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

  const tiles = Array.from({ length: KENO_GAME_TILES_COUNT }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Risk
        <select
          value={value.risk}
          onChange={(e) => onChange({ ...value, risk: e.target.value as KenoParams['risk'] })}
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
        >
          {RISKS.map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
      </label>

      <div className="text-sm text-slate-300">
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
              className={`flex aspect-square items-center justify-center rounded border text-xs font-semibold ${
                isPicked
                  ? 'border-blue-400 bg-blue-600 text-white'
                  : disabled
                    ? 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-700'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tile}
            </button>
          );
        })}
      </div>
    </div>
  );
}
