'use client';

import { useEffect, useState } from 'react';
import type { ChickenOutcome } from '@/lib/types';
import type { ChickenParams } from '@/lib/params';
import { CHICKEN_LANES_COUNT } from '@/lib/params';

const STEP_INTERVAL_MS = 220;

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
  // How far the chicken actually got: all the way if it won, otherwise it
  // stopped at deathPoint.
  const finalReach = outcome.win ? targetLanes : Math.min(outcome.deathPoint, targetLanes);

  const [current, setCurrent] = useState(staged ? 0 : finalReach);

  useEffect(() => {
    if (!staged) {
      setCurrent(finalReach);
      return;
    }
    setCurrent(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setCurrent(step);
      if (step >= finalReach) {
        clearInterval(timer);
        onRevealComplete?.();
      }
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, finalReach]);

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
              : 'bg-red-600 border-red-400 text-white';
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
              className={classes}
            >
              {lane}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Death point: {outcome.deathPoint}</span>
        <span className={outcome.win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
          {outcome.win ? 'WIN' : 'LOSE'}
        </span>
      </div>
    </div>
  );
}
