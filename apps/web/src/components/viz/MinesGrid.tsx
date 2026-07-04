'use client';

import { useEffect, useState } from 'react';
import type { MinesOutcome } from '@/lib/types';
import type { MinesParams } from '@/lib/params';
import { MultiplierChip } from '@/components/games/GameShell';

const TILES = 25;
const COLS = 5;
const REVEAL_INTERVAL_MS = 300;

// Staged reveal: the server already returned the FULL outcome (every mine
// position and the entire revealOrder) in one response -- nothing here is
// invented or faked. When `staged` is true this just paces the reveal of
// tiles already known to be safe/mined, one at a time, for visual "feel".
export function MinesGrid({
  outcome,
  params,
  staged = false,
  onRevealComplete,
}: {
  outcome: MinesOutcome;
  params?: MinesParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(staged ? 0 : outcome.revealOrder.length);

  useEffect(() => {
    if (!staged) {
      setRevealedCount(outcome.revealOrder.length);
      return;
    }
    setRevealedCount(0);
    if (outcome.revealOrder.length === 0) {
      onRevealComplete?.();
      return;
    }
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setRevealedCount(index);
      if (index >= outcome.revealOrder.length) {
        clearInterval(timer);
        onRevealComplete?.();
      }
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, outcome]);

  const mineSet = new Set(outcome.minePositions);
  const revealedTiles = outcome.revealOrder.slice(0, revealedCount);
  const pickSet = new Set(revealedTiles);
  const hitTile = outcome.hitMine ? revealedTiles.find((tile) => mineSet.has(tile)) : undefined;

  const tiles = Array.from({ length: TILES }, (_, index) => index);
  const gemsRevealed = revealedTiles.filter((tile) => !mineSet.has(tile)).length;
  const runningMultiplier = (1 + gemsRevealed * 0.3).toFixed(2);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <MultiplierChip value={`x${runningMultiplier}`} tone="neutral" />
        {params && (
          <span className="text-[11px] text-muted-foreground">
            {params.mines} mines &middot; {params.picks} picks
          </span>
        )}
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        data-testid="mines-grid"
      >
        {tiles.map((tile) => {
          const isMine = mineSet.has(tile);
          const isPick = pickSet.has(tile);
          const isHit = tile === hitTile;

          let classes =
            'flex aspect-square items-center justify-center rounded text-lg font-bold border transition-colors duration-300 ';
          if (isHit) {
            classes += 'bg-red-600 border-red-400 text-white';
          } else if (isMine && isPick) {
            classes += 'bg-slate-800 border-red-900 text-red-500';
          } else if (isPick) {
            classes += 'bg-emerald-600 border-emerald-400 text-white';
          } else {
            classes += 'bg-card border-border text-muted-foreground';
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
              {isHit ? '✗' : isMine && isPick ? '☀' : isPick ? '✓' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
