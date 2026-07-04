import type { KenoOutcome } from '@/lib/types';
import type { KenoParams } from '@/lib/params';
import { KENO_GAME_TILES_COUNT } from '@/lib/params';

const COLS = 8;

export function KenoBoard({ outcome, params }: { outcome: KenoOutcome; params?: KenoParams }) {
  const pickSet = new Set(params?.picks ?? []);
  const drawnSet = new Set(outcome.drawn);
  const hitSet = new Set(outcome.hits);

  const tiles = Array.from({ length: KENO_GAME_TILES_COUNT }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3" data-testid="keno-board">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile) => {
          const isPick = pickSet.has(tile);
          const isDrawn = drawnSet.has(tile);
          const isHit = hitSet.has(tile);

          let classes =
            'flex aspect-square items-center justify-center rounded text-xs font-bold border ';
          if (isHit) {
            classes += 'bg-emerald-600 border-emerald-400 text-white';
          } else if (isDrawn) {
            classes += 'bg-blue-900/60 border-blue-500 text-blue-200';
          } else if (isPick) {
            classes += 'bg-slate-800 border-slate-500 text-slate-200';
          } else {
            classes += 'bg-slate-900 border-slate-700 text-slate-500';
          }

          return (
            <div
              key={tile}
              data-testid={`keno-tile-${tile}`}
              data-pick={isPick}
              data-drawn={isDrawn}
              data-hit={isHit}
              className={classes}
            >
              {tile}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>
          Hits: {outcome.hitCount}
          {params ? ` / ${params.picks.length}` : ''}
        </span>
      </div>
    </div>
  );
}
