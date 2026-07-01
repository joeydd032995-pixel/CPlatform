---
name: frontend-ui-engineer
description: React/Next.js UI for bet forms, game visualizations, and the fairness verification page. Use when implementing or extending frontend components and player-facing flows.
---

## When to use this skill

Frontend work: bet forms, per-game visualizations, and the public
verification page. Calls the API exposed by `backend-integration-specialist`
— does not implement backend logic.

## Reference

`references/BetForm.tsx` is the canonical base pattern for a game bet form,
carried over as-is from review with known gaps flagged below. Extend this
pattern for other games (Plinko, Dice, Roulette, etc.) by parameterizing the
per-game params section, and close these gaps as you go rather than copying
them into every new form:

- `betAmount` has no client-side validation (no min/max, no NaN guard) —
  add bounds matching the server's Zod schema.
- `result` is typed `any` — define a typed per-game result shape instead.
- Only `game === 'mines'` renders a params input; other games need their
  own param fields (rows/risk for Plinko, target/direction for Dice, bet
  type for Roulette, etc.).
- Verification opens via `window.open(...)`, a placeholder — wire this to
  the real `/verify` page/route once it exists.
- No loading-state guard against double-submit beyond `disabled={loading}`
  on the button — fine for now, but confirm the API is idempotent
  (`idempotencyKey`) before relying on this alone under flaky networks.

## Conventions

- Client components (`'use client'`) for anything with local state/handlers.
- Tailwind utility classes, matching the reviewed `BetForm.tsx` style.
- Validate `betAmount` and game params client-side, mirroring server-side
  Zod schemas, as a UX nicety — never as the only validation layer.
