'use client';

import type { RouletteOutcome } from '@/lib/types';
import type { RouletteParams } from '@/lib/params';
import { describeRouletteBet } from '@/lib/roulette-bet-label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RouletteWheel } from '@/components/viz/RouletteWheel';

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-emerald-600 border-emerald-400',
  red: 'bg-red-600 border-red-400',
  black: 'bg-slate-900 border-slate-600',
};

// Real staged reveal: the wheel spins for ~3.5s (see RouletteWheel.tsx) and
// calls onRevealComplete itself once the animation lands on outcome.result.
// When staged is false/undefined (e.g. VerifyForm's reuse of this Viz), the
// wheel renders already at rest and calls onRevealComplete immediately --
// this component doesn't need its own separate effect for that since
// RouletteWheel already implements both branches.
export function RouletteResult({
  outcome,
  staged,
  onRevealComplete,
}: {
  outcome: RouletteOutcome;
  params?: RouletteParams;
  staged?: boolean;
  onRevealComplete?: () => void;
}) {
  const { result, color, win, bets } = outcome;

  // Defensive fallback for any caller/fixture that hasn't been updated to
  // the new per-bet-array outcome shape yet (e.g. an older test mock) --
  // renders the wheel/badge fine with an empty breakdown rather than
  // throwing on `bets.map`.
  const betResults = bets ?? [];
  const totalPayout = betResults.reduce((sum, b) => sum + b.payout, 0);

  return (
    <div className="flex flex-col items-center gap-4" data-testid="roulette-result">
      <RouletteWheel result={result} staged={staged} onRevealComplete={onRevealComplete} />

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

      {betResults.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg ring-1 ring-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-background/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 font-medium">Bet</th>
                <th className="px-2 py-1 font-medium">Amount</th>
                <th className="px-2 py-1 font-medium">Outcome</th>
                <th className="px-2 py-1 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {betResults.map((bet, index) => (
                <tr key={index} className="border-t border-border/60">
                  <td className="px-2 py-1">{describeRouletteBet(bet.betType, bet.numbers, bet.zone)}</td>
                  <td className="px-2 py-1 font-mono">{bet.amount}</td>
                  <td className="px-2 py-1">
                    <span className={bet.win ? 'font-semibold text-emerald-400' : 'text-muted-foreground'}>
                      {bet.win ? 'WIN' : 'LOSE'}
                    </span>
                  </td>
                  <td className="px-2 py-1 font-mono">{bet.payout}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between bg-background/60 px-2 py-1.5 text-xs font-semibold">
            <span>Total payout</span>
            <span className="font-mono">{totalPayout}</span>
          </div>
        </div>
      )}
    </div>
  );
}
