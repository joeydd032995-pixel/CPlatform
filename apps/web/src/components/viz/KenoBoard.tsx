'use client';

import type { KenoOutcome } from '@/lib/types';
import type { KenoParams } from '@/lib/params';
import { KENO_GAME_TILES_COUNT } from '@/lib/params';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useRevealSequence } from '@/hooks/use-reveal-sequence';
import { cn } from '@/lib/utils';

const COLS = 8;

// Staged reveal: the server already returned all drawn numbers in one response.
// When `staged` is true, numbers are highlighted one at a time for draw drama.
export function KenoBoard({
  outcome,
  params,
  staged = false,
  onRevealComplete,
}: {
  outcome: KenoOutcome;
  params?: KenoParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const revealedDrawCount = useRevealSequence({
    total: outcome.drawn.length,
    intervalMs: REVEAL_TIMING.keno,
    staged,
    onRevealComplete,
    resetKey: outcome,
  });

  const pickSet = new Set(params?.picks ?? []);
  const visibleDrawn = outcome.drawn.slice(0, revealedDrawCount);
  const drawnSet = new Set(visibleDrawn);
  const hitSet = new Set(outcome.hits);
  const drawComplete = revealedDrawCount >= outcome.drawn.length;

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
          const isHit = drawComplete && hitSet.has(tile);

          return (
            <div
              key={tile}
              data-testid={`keno-tile-${tile}`}
              data-pick={isPick}
              data-drawn={isDrawn}
              data-hit={isHit}
              className={cn(
                'flex aspect-square items-center justify-center rounded text-xs font-bold ring-1 transition-colors duration-200',
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
          {drawComplete ? (
            <>
              Hits: {outcome.hitCount}
              {params ? ` / ${params.picks.length}` : ''}
            </>
          ) : (
            <>Drawing: {revealedDrawCount} / {outcome.drawn.length}</>
          )}
        </span>
      </div>
    </div>
  );
}