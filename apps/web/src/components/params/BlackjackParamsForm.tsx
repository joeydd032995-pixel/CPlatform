'use client';

import type { BlackjackParams } from '@/lib/params';

// Purely decorative pre-bet preview -- the empty felt, no hands dealt yet
// (that only happens once a bet is placed).
function IdleTable() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card/50 p-4" aria-hidden="true">
      <span className="text-xs text-muted-foreground">Dealer</span>
      <div className="flex gap-2">
        <div className="h-16 w-12 rounded-md border border-border bg-muted" />
      </div>
      <div className="rounded border border-white/10 bg-white/5 px-4 py-1 text-center text-[10px] font-bold tracking-widest text-muted-foreground">
        BLACKJACK PAYS 3 TO 2
      </div>
      <div className="flex gap-2">
        <div className="h-16 w-12 rounded-md border border-border bg-muted" />
        <div className="h-16 w-12 rounded-md border border-border bg-muted" />
      </div>
      <span className="text-xs text-muted-foreground">Player</span>
    </div>
  );
}

// Blackjack has no configurable params (BlackjackParamsSchema is
// z.object({}).strict() server-side) — auto-play strategy is fixed.
export function BlackjackParamsForm({}: {
  value: BlackjackParams;
  onChange: (value: BlackjackParams) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>
        Cards are dealt and played automatically per a fixed basic-strategy table — no
        configuration needed.
      </p>
      <IdleTable />
      <ul className="list-disc pl-5 text-xs">
        <li>Infinite-deck draw (cards are drawn independently, with replacement).</li>
        <li>No split, double, surrender, or insurance.</li>
        <li>Dealer hits to 16 and stands on all 17s (hard or soft).</li>
        <li>Natural blackjack (21 on the first two cards) pays 2.5x, minus house edge.</li>
        <li>A regular win pays 2x, minus house edge; a push returns your bet (1x).</li>
      </ul>
    </div>
  );
}
