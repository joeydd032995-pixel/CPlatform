'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { getSeeds, rotateSeed, setClientSeed as setClientSeedApi } from '@/lib/api-client';
import type { PublicSeedState } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    return <div className="p-6 text-muted-foreground">Loading seed state...</div>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Seeds</h1>

      <Card>
        <CardContent className="grid grid-cols-1 gap-2 pt-6 text-sm sm:grid-cols-2">
          <span className="text-muted-foreground">Active server seed hash</span>
          <span className="truncate font-mono text-xs">{state.serverSeedHash}</span>
          <span className="text-muted-foreground">Client seed</span>
          <span className="font-mono text-xs">{state.clientSeed}</span>
          <span className="text-muted-foreground">Nonce</span>
          <span>{state.nonce}</span>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server seed</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Client seed</TableHead>
                  <TableHead>Final nonce</TableHead>
                  <TableHead>Rotated at</TableHead>
                  <TableHead>Verify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-xs">
                {state.previousSeeds.map((seed, index) => (
                  <TableRow key={index}>
                    <TableCell className="max-w-[10rem] truncate">{seed.serverSeed}</TableCell>
                    <TableCell className="max-w-[10rem] truncate">{seed.serverSeedHash}</TableCell>
                    <TableCell>{seed.clientSeed}</TableCell>
                    <TableCell>{seed.finalNonce}</TableCell>
                    <TableCell>{new Date(seed.rotatedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {/* This history record doesn't retain which game/params
                          produced `finalNonce` (only the seed material and
                          the final nonce reached), so the deep link seeds
                          the Verify form with the seed/nonce prefilled and a
                          placeholder game+params the player can change to
                          match the actual bet they're checking. */}
                      <a
                        href={buildVerifyLink({
                          game: 'mines',
                          nonce: seed.finalNonce,
                          clientSeed: seed.clientSeed,
                          params: { mines: 3, picks: 1 },
                          serverSeed: seed.serverSeed,
                        })}
                        className="text-primary hover:underline"
                      >
                        verify
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
