'use client';

import type { ChickenOutcome } from '@/lib/types';
import type { ChickenParams } from '@/lib/params';
import { CHICKEN_LANES_COUNT } from '@/lib/params';
import { REVEAL_TIMING } from '@/lib/reveal-timing';
import { useRevealSequence } from '@/hooks/use-reveal-sequence';
import { cn } from '@/lib/utils';

// Staged reveal: the server already returned the full outcome (deathPoint +
// win) in one response -- `lanes` was fixed at submit time, there is no
// mid-round decision left to make. This just animates advancing lane-by-lane
// up to the already-known stopping point for visual pacing.
export function ChickenLanes({
  outcome,
  params,
  staged = false,
  onRevealComplete,
}: {
  outcome: ChickenOutcome;
  params?: ChickenParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const targetLanes = params?.lanes ?? 0;
  const finalReach = outcome.win ? targetLanes : Math.min(outcome.deathPoint, targetLanes);

  const current = useRevealSequence({
    total: finalReach,
    intervalMs: REVEAL_TIMING.chicken,
    staged,
    onRevealComplete,
    resetKey: outcome,
  });

  const revealComplete = current >= finalReach;
  const showDeathPulse = revealComplete && !outcome.win;

  const lanes = Array.from({ length: CHICKEN_LANES_COUNT }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3" data-testid="chicken-lanes">
      <div className="flex flex-wrap gap-1.5">
        {lanes.map((lane) => {
          const isDeathPoint = lane === outcome.deathPoint;
          const isAdvanced = lane <= current;
          const isPastDeath = lane >= outcome.deathPoint;

          let classes =
            'flex h-10 w-10 items-center justify-center rounded border text-xs font-bold transition-colors duration-200 ';
          if (isDeathPoint) {
            classes += outcome.win
              ? 'bg-card border-red-600 text-red-400'
              : cn(
                  'bg-red-600 border-red-400 text-white',
                  showDeathPulse && 'animate-death-pulse'
                );
          } else if (isAdvanced && !isPastDeath) {
            classes += 'bg-emerald-600 border-emerald-400 text-white';
          } else if (isAdvanced) {
            classes += 'bg-emerald-900/40 border-emerald-700 text-emerald-300';
          } else {
            classes += 'bg-card border-border text-muted-foreground';
          }

          return (
            <div
              key={lane}
              data-testid={`chicken-lane-${lane}`}
              data-death-point={isDeathPoint}
              data-advanced={isAdvanced}
              className={cn(classes, 'relative')}
            >
              {lane === current && current > 0 && (
                <span
                  data-testid="chicken-marker"
                  className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 text-xl"
                  aria-hidden
                >
                  🐔
                </span>
              )}
              {lane}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Death point: {outcome.deathPoint}</span>
        {revealComplete && (
          <span className={outcome.win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
            {outcome.win ? 'WIN' : 'LOSE'}
          </span>
        )}
      </div>
    </div>
  );
}