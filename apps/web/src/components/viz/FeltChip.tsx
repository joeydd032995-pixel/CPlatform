import { cn } from '@/lib/utils';

export function FeltChip({ amount, className }: { amount: number; className?: string }) {
  if (amount <= 0) return null;

  const label = amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(amount);

  return (
    <span
      className={cn(
        'pointer-events-none absolute right-0.5 top-0.5 z-10 flex h-5 min-w-[1.25rem]',
        'items-center justify-center rounded-full bg-yellow-400 px-0.5',
        'text-[8px] font-bold leading-none text-yellow-950 shadow-sm ring-1 ring-yellow-200',
        className
      )}
    >
      {label}
    </span>
  );
}