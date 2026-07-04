import Link from 'next/link';
import { gamesRegistry, GAME_NAMES } from '@/lib/games';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">CPlatform</h1>
      <p className="text-slate-400">
        A provably-fair gaming platform. Every outcome is derived from an HMAC-SHA256 RNG you can
        independently verify.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {GAME_NAMES.map((name) => (
          <Link
            key={name}
            href={`/games/${name}`}
            className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-lg font-semibold text-slate-100 hover:border-blue-600 hover:bg-slate-900"
          >
            {gamesRegistry[name].label}
          </Link>
        ))}
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/seeds" className="text-blue-400 hover:text-blue-300">
          Manage your seeds
        </Link>
        <Link href="/verify" className="text-blue-400 hover:text-blue-300">
          Verify a bet
        </Link>
      </div>
    </div>
  );
}
