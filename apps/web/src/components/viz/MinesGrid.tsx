import type { MinesOutcome } from '@/lib/types';
import type { MinesParams } from '@/lib/params';

const TILES = 25;
const COLS = 5;

export function MinesGrid({ outcome }: { outcome: MinesOutcome; params?: MinesParams }) {
  const mineSet = new Set(outcome.minePositions);
  const pickSet = new Set(outcome.revealOrder);
  // The last picked tile is the one that would have triggered a hit, if any.
  const hitTile = outcome.hitMine ? outcome.revealOrder.find((tile) => mineSet.has(tile)) : undefined;

  const tiles = Array.from({ length: TILES }, (_, index) => index);

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      data-testid="mines-grid"
    >
      {tiles.map((tile) => {
        const isMine = mineSet.has(tile);
        const isPick = pickSet.has(tile);
        const isHit = tile === hitTile;

        let classes = 'flex aspect-square items-center justify-center rounded text-lg font-bold border ';
        if (isHit) {
          classes += 'bg-red-600 border-red-400 text-white';
        } else if (isMine) {
          classes += 'bg-slate-800 border-red-900 text-red-500';
        } else if (isPick) {
          classes += 'bg-emerald-600 border-emerald-400 text-white';
        } else {
          classes += 'bg-slate-900 border-slate-700 text-slate-500';
        }

        return (
          <div
            key={tile}
            data-testid={`mines-tile-${tile}`}
            data-mine={isMine}
            data-pick={isPick}
            data-hit={isHit}
            className={classes}
          >
            {isHit ? '✗' : isMine ? '☀' : isPick ? '✓' : ''}
          </div>
        );
      })}
    </div>
  );
}
