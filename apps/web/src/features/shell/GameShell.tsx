'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Casino session layout: controls rail (left) + game surface (right).
 * PR1 foundation — widened to max-w-6xl parent, scrollable controls on desktop.
 */
export function GameShell({ controls, surface }: { controls: ReactNode; surface: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="flex max-h-none flex-col gap-4 lg:max-h-[min(720px,85vh)] lg:overflow-y-auto lg:pr-1">
          {controls}
        </div>
        <div className="relative min-h-[min(420px,55vh)] rounded-xl bg-surface-game p-4 ring-1 ring-border/50 sm:min-h-[min(480px,60vh)]">
          {surface}
        </div>
      </div>
    </div>
  );
}

export function PlayButton({
  label = 'PLAY',
  loadingLabel = 'PLACING BET...',
  onClick,
  disabled,
  loading,
}: {
  label?: string;
  loadingLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative w-full overflow-hidden rounded-lg py-6 text-sm font-bold tracking-widest',
        'bg-brand text-brand-foreground shadow-play transition active:scale-[0.98]',
        'hover:bg-brand/90'
      )}
    >
      {loading ? loadingLabel : label}
    </Button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-6 text-sm font-bold tracking-widest"
    >
      {children}
    </Button>
  );
}

export function BetInput({
  text,
  onTextChange,
  error,
  disabled,
}: {
  text: string;
  onTextChange: (text: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const value = Number(text);
  const valid = Number.isFinite(value) && value > 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[44px_1fr_44px] overflow-hidden rounded-lg bg-background ring-1 ring-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => valid && onTextChange(String(value / 2))}
          className="bg-white/[0.03] text-sm text-muted-foreground hover:bg-white/10 disabled:opacity-50"
        >
          ½x
        </button>
        <Input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Bet Amount"
          className={cn(
            'h-auto rounded-none border-0 bg-transparent text-center font-mono text-base shadow-none focus-visible:ring-0',
            error && 'text-destructive'
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTextChange(String((valid ? value : 0) * 2 || 1))}
          className="bg-white/[0.03] text-sm text-muted-foreground hover:bg-white/10 disabled:opacity-50"
        >
          2x
        </button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function ModeTabs<T extends string>({
  modes,
  value,
  onChange,
  disabled,
}: {
  modes: readonly T[];
  value: T;
  onChange: (m: T) => void;
  disabled?: boolean;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => !disabled && onChange(v as T)}>
      <TabsList
        className={cn('grid w-full', disabled && 'pointer-events-none opacity-60')}
        style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
      >
        {modes.map((m) => (
          <TabsTrigger key={m} value={m} className="text-[11px] font-bold tracking-widest">
            {m.toUpperCase()}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function MultiplierChip({
  value,
  tone = 'neutral',
  active = false,
}: {
  value: string;
  tone?: 'neutral' | 'green' | 'orange' | 'red' | 'pink' | 'yellow';
  active?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-white/70 border-white/10',
    green: 'bg-win-muted text-win border-win/30',
    orange: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
    red: 'bg-lose-muted text-lose border-lose/30',
    pink: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30',
    yellow: 'bg-yellow-500/15 text-yellow-300 border-yellow-400/30',
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        'justify-center px-2 py-1 text-[11px] font-bold',
        tones[tone],
        active && 'scale-110 shadow-lg'
      )}
    >
      {value}
    </Badge>
  );
}

export function ControlsSection({
  title,
  children,
  locked,
}: {
  title: string;
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border/40 bg-background/30 p-4',
        locked && 'pointer-events-none opacity-60'
      )}
      aria-busy={locked}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}