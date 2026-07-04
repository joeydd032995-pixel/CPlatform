import type { ChickenOutcome } from '@/lib/types';
import type { ChickenParams } from '@/lib/params';
import { CHICKEN_LANES_COUNT } from '@/lib/params';

export function ChickenLanes({
  outcome,
  params,
}: {
  outcome: ChickenOutcome;
  params?: ChickenParams;
}) {
  const lanes = Array.from({ length: CHICKEN_LANES_COUNT }, (_, index) => index + 1);
  const targetLanes = params?.lanes ?? 0;

  return (
    <div className="flex flex-col gap-3" data-testid="chicken-lanes">
      <div className="flex flex-wrap gap-1.5">
        {lanes.map((lane) => {
          const isDeathPoint = lane === outcome.deathPoint;
          const isAdvanced = lane <= targetLanes;
          const isPastDeath = lane >= outcome.deathPoint;

          let classes =
            'flex h-10 w-10 items-center justify-center rounded border text-xs font-bold ';
          if (isDeathPoint) {
            classes += outcome.win
              ? 'bg-slate-800 border-red-600 text-red-400'
              : 'bg-red-600 border-red-400 text-white';
          } else if (isAdvanced && !isPastDeath) {
            classes += 'bg-emerald-600 border-emerald-400 text-white';
          } else if (isAdvanced) {
            classes += 'bg-emerald-900/40 border-emerald-700 text-emerald-300';
          } else {
            classes += 'bg-slate-900 border-slate-700 text-slate-500';
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
        <span className="text-slate-400">Death point: {outcome.deathPoint}</span>
        <span className={outcome.win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
          {outcome.win ? 'WIN' : 'LOSE'}
        </span>
      </div>
    </div>
  );
}
