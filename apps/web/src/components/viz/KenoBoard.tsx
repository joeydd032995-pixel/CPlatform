import type { KenoOutcome } from '@/lib/types';
import type { KenoParams } from '@/lib/params';
import { KENO_GAME_TILES_COUNT } from '@/lib/params';
import { cn } from '@/lib/utils';

const COLS = 8;

// Single-reveal (per the task's guidance -- Keno's zip counterpart doesn't
// imply a step-by-step narrative the way Mines/Chicken/HiLo do).
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

          return (
            <div
              key={tile}
              data-testid={`keno-tile-${tile}`}
              data-pick={isPick}
              data-drawn={isDrawn}
              data-hit={isHit}
              className={cn(
                'flex aspect-square items-center justify-center rounded text-xs font-bold ring-1',
                isHit
                  ? 'bg-emerald-600 text-white ring-emerald-400'
                  : isDrawn
                    ? 'bg-blue-900/60 text-blue-200 ring-blue-500'
                    : isPick
                      ? 'bg-white/10 text-foreground ring-white/20'
                      : 'bg-card text-muted-foreground ring-border'
              )}
            >
              {tile}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Hits: {outcome.hitCount}
          {params ? ` / ${params.picks.length}` : ''}
        </span>
      </div>
    </div>
  );
}
