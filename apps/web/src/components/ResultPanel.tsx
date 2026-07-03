import type { PlayGameResult } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';

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
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
      <h3 className="text-lg font-bold text-slate-100">Result</h3>
      <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
        <span className="text-slate-500">Payout</span>
        <span className={win ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
          {result.payout.toFixed(2)}
        </span>
        <span className="text-slate-500">Multiplier</span>
        <span>{result.multiplier.toFixed(4)}x</span>
        <span className="text-slate-500">Nonce</span>
        <span>{result.nonce}</span>
        <span className="text-slate-500">Server seed hash</span>
        <span className="truncate font-mono text-xs">{result.serverSeedHash}</span>
      </div>
      <a
        href={verifyHref}
        className="inline-block rounded border border-blue-700 px-4 py-2 text-center text-sm font-semibold text-blue-400 hover:bg-blue-950"
      >
        Verify this bet
      </a>
      <p className="text-xs text-slate-500">
        The server seed is revealed when you rotate it on the Seeds page — verification will
        show the recomputed hash once you provide it there.
      </p>
    </div>
  );
}
