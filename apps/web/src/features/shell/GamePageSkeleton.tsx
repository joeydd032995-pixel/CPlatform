import { Skeleton } from '@/components/ui/skeleton';

export function GamePageSkeleton({ title }: { title?: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        {title ? (
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        ) : (
          <Skeleton className="h-9 w-40" />
        )}
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/90 p-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
          <Skeleton className="min-h-[min(480px,60vh)] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}