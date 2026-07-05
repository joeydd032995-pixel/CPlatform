import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function GenericDealingSkeleton() {
  return (
    <>
      <div className="flex gap-2">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <Skeleton className="h-12 w-12 rounded-lg" />
        <Skeleton className="h-12 w-12 rounded-lg" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Preparing your game...</p>
    </>
  );
}

function BlackjackDealingSkeleton() {
  return (
    <>
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl bg-emerald-950/40 p-6 ring-1 ring-emerald-800/30">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-24 w-16 rounded-md" />
          <Skeleton className="h-24 w-16 rounded-md" />
        </div>
        <Skeleton className="mx-auto h-4 w-48 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-24 w-16 rounded-md" />
          <Skeleton className="h-24 w-16 rounded-md" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">Shuffling the shoe...</p>
    </>
  );
}

function DartsDealingSkeleton() {
  return (
    <>
      <Skeleton className="h-64 w-64 rounded-full" />
      <p className="text-sm font-medium text-muted-foreground">Steadying your aim...</p>
    </>
  );
}

function ChickenDealingSkeleton() {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-10 rounded" />
        ))}
      </div>
      <p className="text-sm font-medium text-muted-foreground">The chicken is warming up...</p>
    </>
  );
}

const VARIANTS: Record<string, () => ReactNode> = {
  blackjack: BlackjackDealingSkeleton,
  darts: DartsDealingSkeleton,
  chicken: ChickenDealingSkeleton,
};

export function DealingSkeleton({ game }: { game?: string }) {
  const Variant = game ? VARIANTS[game] : undefined;

  return (
    <div
      className="flex h-full min-h-[380px] flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Dealing"
      data-testid="dealing-skeleton"
      data-game={game}
    >
      {Variant ? <Variant /> : <GenericDealingSkeleton />}
    </div>
  );
}