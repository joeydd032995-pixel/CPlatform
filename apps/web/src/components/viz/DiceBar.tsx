'use client';

import { useEffect } from 'react';
import type { DiceOutcome } from '@/lib/types';
import type { DiceParams } from '@/lib/params';

// Adapted from the gameframe-studio-x reference's TargetGame.tsx shell
// (big colored result number + history-style framing) to Dice's real
// target/direction/roll mechanic -- there's no Dice equivalent in the zip.
// Single-reveal (no natural staged narrative for a single roll).
export function DiceBar({
  outcome,
  onRevealComplete,
}: {
  outcome: DiceOutcome;
  params?: DiceParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const { roll, target, direction, win } = outcome;

  useEffect(() => {
    onRevealComplete?.();
  }, [onRevealComplete]);

  const winZoneStyle =
    direction === 'over'
      ? { left: `${target}%`, width: `${100 - target}%` }
      : { left: '0%', width: `${target}%` };

  return (
    <div className="flex h-full min-h-[380px] flex-col justify-center gap-6" data-testid="dice-bar">
      <div
        className={`text-center text-6xl font-bold ${win ? 'text-emerald-400' : 'text-red-500'}`}
      >
        {roll.toFixed(2)}
      </div>
      <div className="relative h-6 w-full overflow-hidden rounded bg-muted">
        <div
          className="absolute inset-y-0 bg-emerald-700/50"
          style={winZoneStyle}
          data-testid="dice-win-zone"
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-white"
          style={{ left: `${roll}%` }}
          data-testid="dice-roll-marker"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Target: {direction} {target.toFixed(2)}
        </span>
        <span className={win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
          {win ? 'WIN' : 'LOSE'}
        </span>
      </div>
    </div>
  );
}
