import type { PlayGameResult } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultSummary } from '@/features/shell/ResultSummary';

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
  });

  const win = result.payout > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="sr-only">Result</CardTitle>
      </CardHeader>
      <CardContent>
        <ResultSummary
          payout={result.payout}
          multiplier={result.multiplier}
          nonce={result.nonce}
          serverSeedHash={result.serverSeedHash}
          win={win}
          verifyHref={verifyHref}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          The server seed is revealed when you rotate it on the Seeds page — verification will
          show the recomputed hash once you provide it there.
        </p>
      </CardContent>
    </Card>
  );
}