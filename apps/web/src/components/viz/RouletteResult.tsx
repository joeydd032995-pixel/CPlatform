import type { RouletteOutcome } from '@/lib/types';
import type { RouletteParams } from '@/lib/params';

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-emerald-600 border-emerald-400',
  red: 'bg-red-600 border-red-400',
  black: 'bg-slate-900 border-slate-600',
};

export function RouletteResult({
  outcome,
  params,
}: {
  outcome: RouletteOutcome;
  params: RouletteParams;
}) {
  const { result, color, win } = outcome;

  return (
    <div className="flex flex-col gap-3" data-testid="roulette-result">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-4 text-2xl font-bold text-white ${
            COLOR_CLASSES[color] ?? COLOR_CLASSES.black
          }`}
        >
          {result}
        </div>
        <span
          className={`rounded px-3 py-1 text-sm font-bold ${
            win ? 'bg-emerald-700 text-white' : 'bg-red-800 text-white'
          }`}
        >
          {win ? 'WIN' : 'LOSE'}
        </span>
      </div>
      {params.numbers.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs text-slate-400">
          Covered: {params.numbers.join(', ')}
        </div>
      )}
      {params.zone !== undefined && (
        <div className="text-xs text-slate-400">Zone: {params.zone}</div>
      )}
    </div>
  );
}
