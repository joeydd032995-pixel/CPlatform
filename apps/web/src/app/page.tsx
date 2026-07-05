import Link from 'next/link';
import { Shield, Sprout, SearchCheck } from 'lucide-react';
import { GAME_NAMES } from '@/lib/games';
import { GameCard } from '@/features/lobby/GameCard';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="mb-12 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/80">
            Provably fair gaming
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Play with confidence.{' '}
            <span className="text-muted-foreground">Verify every outcome.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            {GAME_NAMES.length} casino games powered by HMAC-SHA256 RNG. Commit your server seed
            hash before you play, then independently verify any bet after rotation.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/seeds"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:bg-card"
          >
            <Sprout className="h-4 w-4 text-brand" />
            Manage seeds
          </Link>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:bg-card"
          >
            <SearchCheck className="h-4 w-4 text-brand" />
            Verify a bet
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Every outcome is deterministic from server seed + client seed + nonce</span>
        </div>
      </section>

      {/* Game grid */}
      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Choose a game</h2>
          <span className="text-sm text-muted-foreground">{GAME_NAMES.length} games</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_NAMES.map((name) => (
            <GameCard key={name} game={name} />
          ))}
        </div>
      </section>
    </div>
  );
}