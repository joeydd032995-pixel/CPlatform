import type { RouletteOutcome } from '@/lib/types';
import type { RouletteParams } from '@/lib/params';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-emerald-600 border-emerald-400',
  red: 'bg-red-600 border-red-400',
  black: 'bg-slate-900 border-slate-600',
};

// Single-reveal (no zip Roulette equivalent to stage; a single spin has no
// natural multi-step narrative).
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
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full border-4 text-2xl font-bold text-white',
            COLOR_CLASSES[color] ?? COLOR_CLASSES.black
          )}
        >
          {result}
        </div>
        <Badge variant={win ? 'default' : 'destructive'} className={win ? 'bg-emerald-600' : ''}>
          {win ? 'WIN' : 'LOSE'}
        </Badge>
      </div>
      {params.numbers.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          Covered: {params.numbers.join(', ')}
        </div>
      )}
      {params.zone !== undefined && (
        <div className="text-xs text-muted-foreground">Zone: {params.zone}</div>
      )}
    </div>
  );
}
