'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Shared shell + control vocabulary for all game screens, ported from the
 * gameframe-studio-x reference's GameShell.tsx and rebuilt on top of the
 * ported shadcn/ui primitives (Button/Tabs/Badge) rather than raw markup.
 *
 * Left column: controls (params form, PLAY button, bet input).
 * Right column: game surface (the Viz).
 */
export function GameShell({ controls, surface }: { controls: ReactNode; surface: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3">{controls}</div>
        <div className="relative min-h-[420px] rounded-xl bg-background/40 p-4 ring-1 ring-border">
          {surface}
        </div>
      </div>
    </div>
  );
}

export function PlayButton({
  label = 'PLAY',
  onClick,
  disabled,
  loading,
}: {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="relative w-full overflow-hidden rounded-lg py-6 text-sm font-bold tracking-widest text-white shadow-[0_8px_30px_-10px_rgba(217,70,239,0.6)] transition active:scale-[0.98]"
      style={{
        background: 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 40%, #d946ef 100%)',
      }}
    >
      {loading ? 'PLACING BET...' : label}
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

// Numeric bet-amount input. Deliberately does NOT port the zip's fake
// USD-conversion (`* 200`) or hardcoded MIN/MAX (0.00000001 / 1) -- no real
// fiat exchange rate or client-exposed bet limit exists server-side (see
// CLAUDE.md's "Platform bet-limit values" deferred item), so those would be
// actively misleading. Quick 1/2x and 2x multiply buttons replace them.
// Mirrors BetForm.tsx's existing free-typed-text + parsed-number pattern so
// BetAmountSchema validation still drives the caller's canSubmit/error UI.
export function BetInput({
  text,
  onTextChange,
  error,
}: {
  text: string;
  onTextChange: (text: string) => void;
  error?: string | null;
}) {
  const value = Number(text);
  const valid = Number.isFinite(value) && value > 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[44px_1fr_44px] overflow-hidden rounded-lg bg-background ring-1 ring-border">
        <button
          type="button"
          onClick={() => valid && onTextChange(String(value / 2))}
          className="bg-white/[0.03] text-sm text-muted-foreground hover:bg-white/10"
        >
          ½x
        </button>
        <Input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Bet Amount"
          className={cn(
            'h-auto rounded-none border-0 bg-transparent text-center font-mono text-base shadow-none focus-visible:ring-0',
            error && 'text-destructive'
          )}
        />
        <button
          type="button"
          onClick={() => onTextChange(String((valid ? value : 0) * 2 || 1))}
          className="bg-white/[0.03] text-sm text-muted-foreground hover:bg-white/10"
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
}: {
  modes: readonly T[];
  value: T;
  onChange: (m: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList
        className="grid w-full"
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
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    orange: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
    red: 'bg-red-500/15 text-red-300 border-red-400/30',
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
