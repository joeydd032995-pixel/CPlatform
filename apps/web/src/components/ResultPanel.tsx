import Link from 'next/link';
import type { PlayGameResult } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ResultPanel({
  result,
  game,
  clientSeed,
  params,
}: {
  result: PlayGameResult;
  game: string;
  clientSeed: string;
  params: unknown;
}) {
  const verifyHref = buildVerifyLink({
    game,
    nonce: result.nonce,
    clientSeed,
    params,
    // Deliberately omitted -- the server seed for a live bet's active seed
    // hasn't been revealed yet (only its hash has). See the note below.
  });

  const win = result.payout > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Result</CardTitle>
        <Badge variant={win ? 'default' : 'destructive'} className={win ? 'bg-emerald-600' : ''}>
          {win ? 'WIN' : 'LOSE'}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <span>Payout</span>
          <span
            className={win ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}
          >
            {result.payout.toFixed(2)}
          </span>
          <span>Multiplier</span>
          <span className="text-foreground">{result.multiplier.toFixed(4)}x</span>
          <span>Nonce</span>
          <span className="text-foreground">{result.nonce}</span>
          <span>Server seed hash</span>
          <span className="truncate font-mono text-xs text-foreground">
            {result.serverSeedHash}
          </span>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={verifyHref}>Verify this bet</Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          The server seed is revealed when you rotate it on the Seeds page — verification will
          show the recomputed hash once you provide it there.
        </p>
      </CardContent>
    </Card>
  );
}
