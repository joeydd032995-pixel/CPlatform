import type { DiceOutcome } from '@/lib/types';
import type { DiceParams } from '@/lib/params';

export function DiceBar({ outcome }: { outcome: DiceOutcome; params?: DiceParams }) {
  const { roll, target, direction, win } = outcome;

  const winZoneStyle =
    direction === 'over'
      ? { left: `${target}%`, width: `${100 - target}%` }
      : { left: '0%', width: `${target}%` };

  return (
    <div className="flex flex-col gap-2" data-testid="dice-bar">
      <div className="relative h-6 w-full overflow-hidden rounded bg-slate-800">
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
        <span className="text-slate-400">
          Target: {direction} {target.toFixed(2)}
        </span>
        <span className={win ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
          Roll: {roll.toFixed(2)} — {win ? 'WIN' : 'LOSE'}
        </span>
      </div>
    </div>
  );
}
