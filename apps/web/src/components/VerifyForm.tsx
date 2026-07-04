'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { GAME_NAMES, gamesRegistry, isGameName, type GameName, type GameRegistryEntry } from '@/lib/games';
import { verifyBet, ApiError } from '@/lib/api-client';
import type { VerifyResponse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid server seed');
  }, [serverSeed]);

  const clientSeedError = useMemo(() => {
    if (!clientSeed) return null;
    const parsed = ClientSeedSchema.safeParse(clientSeed);
    return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid client seed');
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
      <p className="text-sm text-muted-foreground">
        Independently recompute any bet's outcome from its revealed server seed, client seed,
        nonce, and game parameters.
      </p>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-col gap-1">
            <Label>Game</Label>
            <Select value={game} onValueChange={(v) => handleGameChange(v as GameName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {gamesRegistry[name].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Server seed (64-char hex)</Label>
            <Input
              type="text"
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              className="font-mono text-xs"
            />
            {serverSeedError && <span className="text-xs text-destructive">{serverSeedError}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Client seed</Label>
            <Input
              type="text"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
              className="font-mono text-xs"
            />
            {clientSeedError && <span className="text-xs text-destructive">{clientSeedError}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Nonce</Label>
            <Input
              type="number"
              min={0}
              value={nonce}
              onChange={(e) => setNonce(Number(e.target.value))}
            />
            {nonceError && <span className="text-xs text-destructive">{nonceError}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Params (JSON)</Label>
            <Textarea
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
            {paramsError && <span className="text-xs text-destructive">{paramsError}</span>}
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-fit">
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="border-emerald-800 bg-emerald-950/30">
          <CardContent className="flex flex-col gap-3 pt-6">
            <Badge className="w-fit bg-emerald-700 text-white">VERIFIED</Badge>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Recomputed server seed hash</span>
              <span className="truncate font-mono text-xs">{result.serverSeedHash}</span>
              <span className="text-muted-foreground">Nonce</span>
              <span>{result.nonce}</span>
              <span className="text-muted-foreground">Multiplier</span>
              <span>{result.multiplier.toFixed(4)}x</span>
            </div>
            <Viz
              outcome={result.outcome as unknown as Record<string, unknown>}
              params={parsedParams as Record<string, unknown>}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
