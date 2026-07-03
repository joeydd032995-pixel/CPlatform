'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { gamesRegistry, type GameName, type GameRegistryEntry } from '@/lib/games';
import { getSeeds } from '@/lib/api-client';
import type { PlayGameResult } from '@/lib/types';
import { BetForm } from '@/components/BetForm';
import { ResultPanel } from '@/components/ResultPanel';

// `game` is a runtime string (validated against the registry one level up,
// in games/[game]/page.tsx) rather than a statically-known literal type, so
// indexing `gamesRegistry` here necessarily yields a union of all four
// per-game entry shapes. TypeScript can't collapse that union back to a
// single concrete (P, O) pair without a generic type parameter fixed at a
// literal call site, which isn't possible for a value read from the URL.
// This single, localized widening cast (to `unknown` field types, not
// `any`) is the bridging point for that -- every *value* flowing through it
// (params, outcome, PlayGameResult) stays exactly as strictly typed as it
// was before the cast; only the registry's generic parameters are widened.
type LooseGameEntry = GameRegistryEntry<Record<string, unknown>, Record<string, unknown>>;

export function GamePage({ game }: { game: GameName }) {
  const { userId, refreshBalance } = useUser();
  const entry = gamesRegistry[game] as unknown as LooseGameEntry;

  const [params, setParams] = useState(entry.defaults);
  const [result, setResult] = useState<PlayGameResult | null>(null);
  const [clientSeed, setClientSeed] = useState<string>('');

  useEffect(() => {
    setParams(entry.defaults);
    setResult(null);
  }, [game, entry.defaults]);

  useEffect(() => {
    if (!userId) return;
    getSeeds(userId)
      .then((state) => setClientSeed(state.clientSeed))
      .catch(() => setClientSeed(''));
  }, [userId, result]);

  const ParamsForm = entry.ParamsForm;
  const Viz = entry.Viz;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-slate-100">{entry.label}</h1>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-3 text-lg font-bold text-slate-100">Parameters</h2>
        <ParamsForm value={params} onChange={setParams} />
      </div>

      {userId && (
        <BetForm
          game={game}
          userId={userId}
          params={params}
          onResult={setResult}
          refreshBalance={refreshBalance}
        />
      )}

      {result && (
        <>
          <ResultPanel result={result} game={game} clientSeed={clientSeed} params={params} />
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-100">Outcome</h3>
            {/* result.outcome is typed as the union GameOutcome, but by
                construction (this game's dispatch key produced it) it always
                matches this game's Viz's expected shape. */}
            <Viz
              outcome={result.outcome as unknown as Record<string, unknown>}
              params={params}
            />
          </div>
        </>
      )}
    </div>
  );
}
