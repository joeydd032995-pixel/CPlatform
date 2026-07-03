'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { getSeeds, rotateSeed, setClientSeed as setClientSeedApi } from '@/lib/api-client';
import type { PublicSeedState } from '@/lib/types';
import { buildVerifyLink } from '@/lib/verify-link';

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
    return <div className="p-6 text-slate-400">Loading seed state...</div>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Seeds</h1>

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-sm sm:grid-cols-2">
        <span className="text-slate-500">Active server seed hash</span>
        <span className="truncate font-mono text-xs">{state.serverSeedHash}</span>
        <span className="text-slate-500">Client seed</span>
        <span className="font-mono text-xs">{state.clientSeed}</span>
        <span className="text-slate-500">Nonce</span>
        <span>{state.nonce}</span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold">Set client seed</h2>
        <input
          type="text"
          value={clientSeedInput}
          onChange={(e) => setClientSeedInput(e.target.value)}
          maxLength={64}
          className="rounded border border-slate-700 bg-slate-950 p-2 font-mono text-sm text-slate-100"
        />
        <button
          onClick={handleSetClientSeed}
          disabled={loading}
          className="w-fit rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Update client seed
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold">Rotate server seed</h2>
        <p className="text-sm text-slate-400">
          Rotating retires your current server seed and reveals it, so every bet made against it
          can be independently verified. A new seed is committed (hash-only) immediately.
        </p>
        <button
          onClick={handleRotate}
          disabled={loading}
          className="w-fit rounded bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Rotate seed
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-3 text-lg font-bold">Revealed seeds</h2>
        {state.previousSeeds.length === 0 ? (
          <p className="text-sm text-slate-500">No rotated seeds yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2">Server seed</th>
                <th className="pb-2">Hash</th>
                <th className="pb-2">Client seed</th>
                <th className="pb-2">Final nonce</th>
                <th className="pb-2">Rotated at</th>
                <th className="pb-2">Verify</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {state.previousSeeds.map((seed, index) => (
                <tr key={index} className="border-t border-slate-800">
                  <td className="max-w-[10rem] truncate py-2 pr-2">{seed.serverSeed}</td>
                  <td className="max-w-[10rem] truncate py-2 pr-2">{seed.serverSeedHash}</td>
                  <td className="py-2 pr-2">{seed.clientSeed}</td>
                  <td className="py-2 pr-2">{seed.finalNonce}</td>
                  <td className="py-2 pr-2">{new Date(seed.rotatedAt).toLocaleString()}</td>
                  <td className="py-2 pr-2">
                    {/* This history record doesn't retain which game/params
                        produced `finalNonce` (only the seed material and the
                        final nonce reached), so the deep link seeds the
                        Verify form with the seed/nonce prefilled and a
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
                      className="text-blue-400 hover:text-blue-300"
                    >
                      verify
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
