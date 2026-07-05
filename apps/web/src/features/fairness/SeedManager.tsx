'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { getSeeds, rotateSeed, setClientSeed as setClientSeedApi } from '@/lib/api-client';
import type { PublicSeedState } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';
import { PageShell } from '@/features/fairness/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function SeedManager() {
  const { userId } = useUser();
  const [state, setState] = useState<PublicSeedState | null>(null);
  const [clientSeedInput, setClientSeedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    const seeds = await getSeeds(uid);
    setState(seeds);
    setClientSeedInput(seeds.clientSeed);
  };

  useEffect(() => {
    if (userId) {
      load(userId).catch(() => setError('Failed to load seed state.'));
    }
  }, [userId]);

  const handleRotate = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      await rotateSeed(userId, crypto.randomUUID());
      await load(userId);
    } catch {
      setError('Failed to rotate seed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetClientSeed = async () => {
    if (!userId) return;
    const trimmed = clientSeedInput.trim();
    if (trimmed.length < 1 || trimmed.length > 64) {
      setError('Client seed must be 1-64 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const seeds = await setClientSeedApi(userId, trimmed);
      setState(seeds);
    } catch {
      setError('Failed to update client seed.');
    } finally {
      setLoading(false);
    }
  };

  if (!userId || !state) {
    return (
      <PageShell title="Seeds" description="Manage your provably-fair seed pair.">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Seeds"
      description="Your active server seed is committed as a hash before play. Rotate to reveal the previous seed and verify every bet made against it."
    >
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 text-sm sm:grid-cols-[10rem_1fr] sm:gap-x-4 sm:gap-y-2">
          <span className="text-muted-foreground">Active server seed hash</span>
          <span className="truncate font-mono text-xs tabular-nums">{state.serverSeedHash}</span>
          <span className="text-muted-foreground">Client seed</span>
          <span className="font-mono text-xs">{state.clientSeed}</span>
          <span className="text-muted-foreground">Nonce</span>
          <span className="tabular-nums">{state.nonce}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set client seed</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            type="text"
            value={clientSeedInput}
            onChange={(e) => setClientSeedInput(e.target.value)}
            maxLength={64}
            className="font-mono text-sm"
          />
          <Button onClick={handleSetClientSeed} disabled={loading} className="w-fit">
            Update client seed
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rotate server seed</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Rotating retires your current server seed and reveals it, so every bet made against it
            can be independently verified. A new seed is committed (hash-only) immediately.
          </p>
          <Button
            onClick={handleRotate}
            disabled={loading}
            className="w-fit bg-amber-600 text-white hover:bg-amber-700"
          >
            Rotate seed
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Revealed seeds</CardTitle>
        </CardHeader>
        <CardContent>
          {state.previousSeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rotated seeds yet.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto px-2">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Server seed</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Client seed</TableHead>
                    <TableHead className="text-right">Final nonce</TableHead>
                    <TableHead>Rotated at</TableHead>
                    <TableHead>Verify</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-mono text-xs">
                  {state.previousSeeds.map((seed, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-[10rem] truncate" title={seed.serverSeed}>
                        {seed.serverSeed}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate" title={seed.serverSeedHash}>
                        {seed.serverSeedHash}
                      </TableCell>
                      <TableCell>{seed.clientSeed}</TableCell>
                      <TableCell className="text-right tabular-nums">{seed.finalNonce}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(seed.rotatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <a
                          href={buildVerifyLink({
                            game: 'mines',
                            nonce: seed.finalNonce,
                            clientSeed: seed.clientSeed,
                            params: { mines: 3, picks: 1 },
                            serverSeed: seed.serverSeed,
                          })}
                          className="font-sans text-primary hover:underline"
                        >
                          verify
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}