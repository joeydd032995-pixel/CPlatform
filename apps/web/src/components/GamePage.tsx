'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { gamesRegistry, type GameName, type GameRegistryEntry } from '@/lib/games';
import { getSeeds } from '@/lib/api-client';
import type { PlayGameResult } from '@/lib/types';
import { BetForm } from '@/components/BetForm';
import { ResultPanel } from '@/components/ResultPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

// The backend is one-shot: POST /api/games/:game already returns the FULL
// outcome (e.g. Mines' revealOrder for every pick, Chicken's deathPoint,
// HiLo's full step sequence). Nothing here invents extra server round-trips
// -- this is a purely client-side reveal PACING state machine layered on
// top of a result that already arrived complete and fair:
//   idle       -- no bet placed yet, params form + BetForm are interactive.
//   dealing    -- bet just landed, brief cosmetic pause before reveal starts.
//   revealing  -- the per-game Viz is staging its own reveal animation over
//                 the already-known outcome array and will call
//                 onRevealComplete when it finishes.
//   done       -- final ResultPanel + fully-revealed Viz shown.
type RevealPhase = 'idle' | 'dealing' | 'revealing' | 'done';

const DEALING_PAUSE_MS = 450;

export function GamePage({ game }: { game: GameName }) {
  const { userId, refreshBalance } = useUser();
  const entry = gamesRegistry[game] as unknown as LooseGameEntry;

  const [params, setParams] = useState(entry.defaults);
  const [result, setResult] = useState<PlayGameResult | null>(null);
  const [clientSeed, setClientSeed] = useState<string>('');
  const [phase, setPhase] = useState<RevealPhase>('idle');

  useEffect(() => {
    setParams(entry.defaults);
    setResult(null);
    setPhase('idle');
  }, [game, entry.defaults]);

  useEffect(() => {
    if (!userId) return;
    getSeeds(userId)
      .then((state) => setClientSeed(state.clientSeed))
      .catch(() => setClientSeed(''));
  }, [userId, result]);

  useEffect(() => {
    if (phase !== 'dealing') return;
    const timer = setTimeout(() => setPhase('revealing'), DEALING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleResult = (next: PlayGameResult) => {
    setResult(next);
    setPhase('dealing');
  };

  const ParamsForm = entry.ParamsForm;
  const Viz = entry.Viz;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{entry.label}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <ParamsForm value={params} onChange={setParams} />
        </CardContent>
      </Card>

      {userId && (
        <BetForm
          game={game}
          userId={userId}
          params={params}
          onResult={handleResult}
          refreshBalance={refreshBalance}
        />
      )}

      {result && (
        <>
          {phase === 'done' && (
            <ResultPanel result={result} game={game} clientSeed={clientSeed} params={params} />
          )}
          <Card>
            <CardHeader>
              <CardTitle>{phase === 'dealing' ? 'Dealing...' : 'Outcome'}</CardTitle>
            </CardHeader>
            <CardContent>
              {phase === 'dealing' ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  Dealing your hand...
                </div>
              ) : (
                // result.outcome is typed as the union GameOutcome, but by
                // construction (this game's dispatch key produced it) it
                // always matches this game's Viz's expected shape.
                <Viz
                  outcome={result.outcome as unknown as Record<string, unknown>}
                  params={params}
                  staged={phase === 'revealing'}
                  onRevealComplete={() => setPhase('done')}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
