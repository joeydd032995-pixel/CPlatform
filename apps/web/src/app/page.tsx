import Link from 'next/link';
import { gamesRegistry, GAME_NAMES } from '@/lib/games';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">CPlatform</h1>
      <p className="text-muted-foreground">
        A provably-fair gaming platform. Every outcome is derived from an HMAC-SHA256 RNG you can
        independently verify.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {GAME_NAMES.map((name) => (
          <Link key={name} href={`/games/${name}`}>
            <Card className="transition hover:border-primary">
              <CardContent className="flex items-center justify-center p-6 text-lg font-semibold">
                {gamesRegistry[name].label}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/seeds" className="text-primary hover:underline">
          Manage your seeds
        </Link>
        <Link href="/verify" className="text-primary hover:underline">
          Verify a bet
        </Link>
      </div>
    </div>
  );
}
