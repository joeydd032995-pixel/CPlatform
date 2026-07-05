'use client';

import type { MinesRoundView } from '@/lib/types';
import { cn } from '@/lib/utils';

const TILES = 25;
const COLS = 5;

// Round-based Mines: the server determines which board position each
// "reveal" actually lands on (a precomputed, domain-separated reveal order
// -- see packages/games/src/mines.ts), exactly like the existing one-shot
// Mines game already does (the player there only chooses a pick COUNT, not
// positions either). So every unrevealed tile is an equivalent click target
// -- clicking any of them triggers the same "reveal next" action, and
// whichever position the server determined lights up in response.
export function MinesRoundGrid({
  round,
  onReveal,
  disabled,
}: {
  round: MinesRoundView;
  onReveal?: () => void;
  disabled?: boolean;
}) {
  const revealedSet = new Set(round.revealedTiles);
  const mineSet = new Set(round.minePositions ?? []);
  const roundOver = round.status !== 'OPEN';
  const hitTile =
    round.status === 'BUSTED' ? round.revealedTiles[round.revealedTiles.length - 1] : undefined;

  const tiles = Array.from({ length: TILES }, (_, i) => i);

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      data-testid="mines-round-grid"
    >
      {tiles.map((tile) => {
        const isRevealed = revealedSet.has(tile);
        const isMine = roundOver && mineSet.has(tile);
        const isHit = tile === hitTile;
        const clickable = round.status === 'OPEN' && !isRevealed && !disabled && !!onReveal;

        return (
          <button
            key={tile}
            type="button"
            disabled={!clickable}
            onClick={onReveal}
            data-testid={`mines-round-tile-${tile}`}
            data-revealed={isRevealed}
            data-mine={isMine}
            data-hit={isHit}
            aria-label={isRevealed ? `Tile ${tile + 1}, revealed` : `Reveal a tile`}
            className={cn(
              'flex aspect-square items-center justify-center rounded border text-lg font-bold transition-colors duration-200',
              isHit && 'border-red-400 bg-red-600 text-white',
              !isHit && isMine && 'border-red-900 bg-slate-800 text-red-500',
              !isHit && !isMine && isRevealed && 'border-emerald-400 bg-emerald-600 text-white',
              !isHit &&
                !isMine &&
                !isRevealed &&
                (clickable
                  ? 'cursor-pointer border-border bg-card text-muted-foreground hover:border-brand/50 hover:bg-card/80'
                  : 'border-border bg-card text-muted-foreground')
            )}
          >
            {isHit ? '✗' : isMine ? '☀' : isRevealed ? '✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
