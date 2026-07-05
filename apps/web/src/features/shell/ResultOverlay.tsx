'use client';

import type { PlayGameResult } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { ResultSummary } from './ResultSummary';
import { cn } from '@/lib/utils';

export function ResultOverlay({
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
  const reducedMotion = useReducedMotion();
  const win = result.payout > 0;

  const verifyHref = buildVerifyLink({
    game,
    nonce: result.nonce,
    clientSeed,
    params,
  });

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-10 border-t border-border/60 bg-card/95 p-4 backdrop-blur-md',
        'rounded-b-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.5)]',
        !reducedMotion && 'animate-in slide-in-from-bottom-4 fade-in duration-300'
      )}
      role="status"
      aria-live="polite"
    >
      <ResultSummary
        payout={result.payout}
        multiplier={result.multiplier}
        nonce={result.nonce}
        serverSeedHash={result.serverSeedHash}
        win={win}
        verifyHref={verifyHref}
        compact
      />
    </div>
  );
}