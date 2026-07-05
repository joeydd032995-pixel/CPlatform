'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { z } from 'zod';
import {
  GAME_NAMES,
  gameRegistry,
  isGameName,
  loadGameModule,
  type GameName,
} from '@/lib/games';
import type { LoadedGameModule, ParamsFormProps, VizProps } from '@/features/games/types';
import { verifyBet, ApiError } from '@/lib/api-client';
import type { VerifyResponse } from '@/lib/types';
import { PageShell } from '@/features/fairness/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

type VizComponent = ComponentType<VizProps<Record<string, unknown>, Record<string, unknown>>>;
type ParamsFormComponent = ComponentType<ParamsFormProps<Record<string, unknown>>>;

export function VerifyForm({
  initialGame,
  initialServerSeed,
  initialClientSeed,
  initialNonce,
  initialParams,
}: VerifyFormProps) {
  const initial = defaultGame(initialGame);
  const [game, setGame] = useState<GameName>(initial);
  const [serverSeed, setServerSeed] = useState(initialServerSeed ?? '');
  const [clientSeed, setClientSeed] = useState(initialClientSeed ?? '');
  const [nonce, setNonce] = useState(initialNonce ?? 0);
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    const defaults = gameRegistry[initial].defaults as Record<string, unknown>;
    return (initialParams ?? defaults) as Record<string, unknown>;
  });
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(
      (initialParams ?? gameRegistry[initial].defaults) as Record<string, unknown>,
      null,
      2
    )
  );
  const [paramsTab, setParamsTab] = useState<'form' | 'json'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [Viz, setViz] = useState<VizComponent | null>(null);
  const [ParamsForm, setParamsForm] = useState<ParamsFormComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setViz(null);
    setParamsForm(null);
    void loadGameModule(game).then((mod: LoadedGameModule) => {
      if (!cancelled) {
        setViz(() => mod.Viz as VizComponent);
        setParamsForm(() => mod.ParamsForm as ParamsFormComponent);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

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

  let parsedParams: unknown = params;
  let paramsError: string | null = null;
  if (paramsTab === 'json') {
    try {
      parsedParams = JSON.parse(jsonText);
    } catch {
      paramsError = 'Params must be valid JSON';
    }
  }

  const canSubmit =
    ServerSeedSchema.safeParse(serverSeed).success &&
    ClientSeedSchema.safeParse(clientSeed).success &&
    NonceSchema.safeParse(nonce).success &&
    !paramsError &&
    !loading;

  const handleGameChange = (next: GameName) => {
    setGame(next);
    const defaults = gameRegistry[next].defaults as Record<string, unknown>;
    setParams(defaults);
    setJsonText(JSON.stringify(defaults, null, 2));
    setResult(null);
  };

  const handleParamsChange = (next: Record<string, unknown>) => {
    setParams(next);
    setJsonText(JSON.stringify(next, null, 2));
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

  return (
    <PageShell
      title="Verify a bet"
      description="Independently recompute any bet's outcome from its revealed server seed, client seed, nonce, and game parameters."
    >
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="verify-game">Game</Label>
            <Select value={game} onValueChange={(v) => handleGameChange(v as GameName)}>
              <SelectTrigger id="verify-game">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {gameRegistry[name].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(game === 'mines' || game === 'blackjack') && (
              <p className="text-xs text-muted-foreground">
                This verifier recomputes a single one-shot bet. A cashed-out Mines
                round or a Blackjack round with real hit/stand/double/split
                decisions is verified differently: the seeds and starting
                parameters fix a <em>family</em> of possible outcomes (one per
                decision path), and fairness is proven by replaying the round's
                exact recorded decisions via <code>POST /api/verify/round</code>{' '}
                and confirming it reproduces the same final result — not a
                weaker guarantee than one-shot verification, just a different
                one suited to a bet that spans multiple decisions.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="verify-server-seed">Server seed (64-char hex)</Label>
            <Input
              id="verify-server-seed"
              type="text"
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              className="font-mono text-xs"
            />
            {serverSeedError && <span className="text-xs text-destructive">{serverSeedError}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="verify-client-seed">Client seed</Label>
            <Input
              id="verify-client-seed"
              type="text"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
              className="font-mono text-xs"
            />
            {clientSeedError && <span className="text-xs text-destructive">{clientSeedError}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="verify-nonce">Nonce</Label>
            <Input
              id="verify-nonce"
              type="number"
              min={0}
              value={nonce}
              onChange={(e) => setNonce(Number(e.target.value))}
              className="tabular-nums"
            />
            {nonceError && <span className="text-xs text-destructive">{nonceError}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Game parameters</Label>
            <Tabs
              value={paramsTab}
              onValueChange={(value) => {
                const next = value as 'form' | 'json';
                if (next === 'form' && paramsTab === 'json') {
                  try {
                    setParams(JSON.parse(jsonText) as Record<string, unknown>);
                  } catch {
                    // Keep the last valid form state if JSON is malformed.
                  }
                }
                setParamsTab(next);
              }}
            >
              <TabsList>
                <TabsTrigger value="form">Controls</TabsTrigger>
                <TabsTrigger value="json">Advanced JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="mt-3 rounded-lg border border-border p-4">
                {ParamsForm ? (
                  <ParamsForm value={params} onChange={handleParamsChange} />
                ) : (
                  <Skeleton className="h-32 w-full rounded-lg" />
                )}
              </TabsContent>
              <TabsContent value="json" className="mt-3">
                <Textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                  spellCheck={false}
                />
              </TabsContent>
            </Tabs>
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
          <CardContent className="flex flex-col gap-4 pt-6">
            <Badge className="w-fit bg-emerald-700 text-white">VERIFIED</Badge>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[12rem_1fr]">
              <span className="text-muted-foreground">Recomputed server seed hash</span>
              <span className="truncate font-mono text-xs tabular-nums">{result.serverSeedHash}</span>
              <span className="text-muted-foreground">Nonce</span>
              <span className="tabular-nums">{result.nonce}</span>
              <span className="text-muted-foreground">Multiplier</span>
              <span className="tabular-nums">{result.multiplier.toFixed(4)}x</span>
            </div>
            {Viz ? (
              <Viz
                outcome={result.outcome as unknown as Record<string, unknown>}
                params={parsedParams as Record<string, unknown>}
              />
            ) : (
              <Skeleton className="h-48 w-full rounded-xl" />
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}