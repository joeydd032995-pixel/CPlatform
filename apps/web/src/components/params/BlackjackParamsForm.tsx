'use client';

import type { BlackjackParams } from '@/lib/params';

// Blackjack has no configurable params (BlackjackParamsSchema is
// z.object({}).strict() server-side) — auto-play strategy is fixed.
export function BlackjackParamsForm({}: {
  value: BlackjackParams;
  onChange: (value: BlackjackParams) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <p>
        Cards are dealt and played automatically per a fixed basic-strategy table — no
        configuration needed.
      </p>
      <ul className="list-disc pl-5 text-xs text-slate-400">
        <li>Infinite-deck draw (cards are drawn independently, with replacement).</li>
        <li>No split, double, surrender, or insurance.</li>
        <li>Dealer hits to 16 and stands on all 17s (hard or soft).</li>
        <li>Natural blackjack (21 on the first two cards) pays 2.5x, minus house edge.</li>
        <li>A regular win pays 2x, minus house edge; a push returns your bet (1x).</li>
      </ul>
    </div>
  );
}
