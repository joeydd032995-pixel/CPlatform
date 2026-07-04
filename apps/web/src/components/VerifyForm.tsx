'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { GAME_NAMES, gamesRegistry, isGameName, type GameName, type GameRegistryEntry } from '@/lib/games';
import { verifyBet, ApiError } from '@/lib/api-client';
import type { VerifyResponse } from '@/lib/types';

// Mirrors packages/core-rng/src/rng.ts's RNGOptionsSchema.serverSeed.
const ServerSeedSchema = z.string().regex(/^[0-9a-f]{64}$/i, 'Must be 64-char hex');
const ClientSeedSchema = z.string().min(1).max(64);
const NonceSchema = z.number().int().nonnegative();

export type VerifyFormProps = {
  initialGame?: string;
  initialServerSeed?: string;
  initialClientSeed?: string;
  initialNonce?: number;
  initialParams?: unknown;
};

const FALLBACK_GAME: GameName = 'mines';

function defaultGame(initialGame?: string): GameName {
  if (initialGame && isGameName(initialGame)) return initialGame;
  return GAME_NAMES[0] ?? FALLBACK_GAME;
}

export function VerifyForm({
  initialGame,
  initialServerSeed,
  initialClientSeed,
  initialNonce,
  initialParams,
}: VerifyFormProps) {
  const [game, setGame] = useState<GameName>(defaultGame(initialGame));
  const [serverSeed, setServerSeed] = useState(initialServerSeed ?? '');
  const [clientSeed, setClientSeed] = useState(initialClientSeed ?? '');
  const [nonce, setNonce] = useState(initialNonce ?? 0);
  const [paramsText, setParamsText] = useState(() =>
    JSON.stringify(initialParams ?? gamesRegistry[defaultGame(initialGame)].defaults, null, 2)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const serverSeedError = useMemo(() => {
    if (!serverSeed) return null;
    const parsed = ServerSeedSchema.safeParse(serverSeed);
    return parsed.success ? null : parsed.error.issues[0]?.message ?? 'Invalid server seed';
  }, [serverSeed]);

  const clientSeedError = useMemo(() => {
    if (!clientSeed) return null;
    const parsed = ClientSeedSchema.safeParse(clientSeed);
    return parsed.success ? null : parsed.error.issues[0]?.message ?? 'Invalid client seed';
  }, [clientSeed]);

  const nonceError = useMemo(() => {
    const parsed = NonceSchema.safeParse(nonce);
    return parsed.success ? null : 'Nonce must be a non-negative integer';
  }, [nonce]);

  let parsedParams: unknown;
  let paramsError: string | null = null;
  try {
    parsedParams = JSON.parse(paramsText);
  } catch {
    paramsError = 'Params must be valid JSON';
  }

  const canSubmit =
    ServerSeedSchema.safeParse(serverSeed).success &&
    ClientSeedSchema.safeParse(clientSeed).success &&
    NonceSchema.safeParse(nonce).success &&
    !paramsError &&
    !loading;

  const handleGameChange = (next: GameName) => {
    setGame(next);
    setParamsText(JSON.stringify(gamesRegistry[next].defaults, null, 2));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await verifyBet({
        serverSeed,
        clientSeed,
        nonce,
        game,
        params: parsedParams,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to verify this bet.');
    } finally {
      setLoading(false);
    }
  };

  // Same widening rationale as GamePage.tsx's LooseGameEntry: `game` is
  // runtime-selected state, not a literal type, so the registry lookup
  // yields a union of per-game Viz signatures that can't be called
  // generically without this documented, localized cast.
  type LooseGameEntry = GameRegistryEntry<Record<string, unknown>, Record<string, unknown>>;
  const Viz = (gamesRegistry[game] as unknown as LooseGameEntry).Viz;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Verify a bet</h1>
      <p className="text-sm text-slate-400">
        Independently recompute any bet's outcome from its revealed server seed, client seed,
        nonce, and game parameters.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Game
          <select
            value={game}
            onChange={(e) => handleGameChange(e.target.value as GameName)}
            className="rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          >
            {GAME_NAMES.map((name) => (
              <option key={name} value={name}>
                {gamesRegistry[name].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Server seed (64-char hex)
          <input
            type="text"
            value={serverSeed}
            onChange={(e) => setServerSeed(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-100"
          />
          {serverSeedError && <span className="text-xs text-red-400">{serverSeedError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Client seed
          <input
            type="text"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-100"
          />
          {clientSeedError && <span className="text-xs text-red-400">{clientSeedError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Nonce
          <input
            type="number"
            min={0}
            value={nonce}
            onChange={(e) => setNonce(Number(e.target.value))}
            className="rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
          {nonceError && <span className="text-xs text-red-400">{nonceError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Params (JSON)
          <textarea
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            rows={5}
            className="rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-100"
          />
          {paramsError && <span className="text-xs text-red-400">{paramsError}</span>}
        </label>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-fit rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-800 bg-emerald-950/30 p-6">
          <span className="w-fit rounded bg-emerald-700 px-3 py-1 text-sm font-bold text-white">
            VERIFIED
          </span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-slate-500">Recomputed server seed hash</span>
            <span className="truncate font-mono text-xs">{result.serverSeedHash}</span>
            <span className="text-slate-500">Nonce</span>
            <span>{result.nonce}</span>
            <span className="text-slate-500">Multiplier</span>
            <span>{result.multiplier.toFixed(4)}x</span>
          </div>
          <Viz outcome={result.outcome as unknown as Record<string, unknown>} params={parsedParams as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
