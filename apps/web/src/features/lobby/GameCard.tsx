import Link from 'next/link';
import { gameRegistry, type GameName } from '@/lib/games';
import { gameMeta } from '@/lib/game-meta';
import { cn } from '@/lib/utils';

export function GameCard({ game }: { game: GameName }) {
  const { label } = gameRegistry[game];
  const meta = gameMeta[game];
  const Icon = meta.icon;

  return (
    <Link
      href={`/games/${game}`}
      className={cn(
        'group flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/80 p-5',
        'ring-1 ring-transparent transition-all duration-200',
        'hover:-translate-y-1 hover:border-border hover:bg-card hover:shadow-lg',
        meta.accentRing
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset',
          meta.accentBg,
          meta.accent
        )}
      >
        <Icon className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold tracking-tight">{label}</span>
        <span className="text-sm leading-snug text-muted-foreground">{meta.description}</span>
      </div>
    </Link>
  );
}