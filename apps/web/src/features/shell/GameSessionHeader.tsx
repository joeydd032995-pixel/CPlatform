'use client';

import Link from 'next/link';
import { Wallet, Sprout } from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { PhaseBadge } from './PhaseBadge';
import type { RevealPhase } from './reveal-phase';
import { cn } from '@/lib/utils';

function truncateSeed(seed: string): string {
  if (seed.length <= 16) return seed;
  return `${seed.slice(0, 8)}…${seed.slice(-4)}`;
}

export function GameSessionHeader({
  title,
  phase,
  clientSeed,
}: {
  title: string;
  phase: RevealPhase;
  clientSeed: string;
}) {
  const { balance } = useUser();

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/80">
          Provably fair
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <PhaseBadge phase={phase} />

        <div
          className={cn(
            'flex items-center gap-2 rounded-full border border-border/60 bg-background/60',
            'px-3 py-1.5 text-sm backdrop-blur-sm'
          )}
        >
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Balance</span>
          <span className="font-mono font-semibold tabular-nums">
            {balance === null ? '—' : balance.toFixed(2)}
          </span>
        </div>

        {clientSeed && (
          <Link
            href="/seeds"
            className={cn(
              'flex items-center gap-2 rounded-full border border-border/60 bg-background/60',
              'px-3 py-1.5 text-xs backdrop-blur-sm transition-colors hover:border-brand/40 hover:text-foreground'
            )}
            title={clientSeed}
          >
            <Sprout className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Seed</span>
            <span className="max-w-[8rem] truncate font-mono">{truncateSeed(clientSeed)}</span>
          </Link>
        )}
      </div>
    </header>
  );
}