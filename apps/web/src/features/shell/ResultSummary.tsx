import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ResultSummaryProps = {
  payout: number;
  multiplier: number;
  nonce: number;
  serverSeedHash: string;
  win: boolean;
  verifyHref?: string;
  compact?: boolean;
  title?: string;
};

export function ResultSummary({
  payout,
  multiplier,
  nonce,
  serverSeedHash,
  win,
  verifyHref,
  compact = false,
  title = 'Result',
}: ResultSummaryProps) {
  return (
    <div className={cn('flex flex-col gap-3', compact && 'gap-2')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-semibold tracking-tight', compact ? 'text-sm' : 'text-base')}>
          {title}
        </span>
        <Badge
          variant={win ? 'default' : 'destructive'}
          className={win ? 'bg-win text-white hover:bg-win/90' : ''}
        >
          {win ? 'WIN' : 'LOSE'}
        </Badge>
      </div>

      <div
        className={cn(
          'grid grid-cols-2 gap-x-4 gap-y-1 text-sm',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <span className="text-muted-foreground">Payout</span>
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            win ? 'text-win' : 'text-lose'
          )}
        >
          {payout.toFixed(2)}
        </span>
        <span className="text-muted-foreground">Multiplier</span>
        <span className="font-mono tabular-nums text-foreground">{multiplier.toFixed(4)}x</span>
        {!compact && (
          <>
            <span className="text-muted-foreground">Nonce</span>
            <span className="tabular-nums text-foreground">{nonce}</span>
            <span className="text-muted-foreground">Server seed hash</span>
            <span className="truncate font-mono text-xs text-foreground">{serverSeedHash}</span>
          </>
        )}
      </div>

      {verifyHref && (
        <Button asChild variant="outline" size={compact ? 'sm' : 'default'} className="w-full">
          <Link href={verifyHref}>Verify this bet</Link>
        </Button>
      )}
    </div>
  );
}