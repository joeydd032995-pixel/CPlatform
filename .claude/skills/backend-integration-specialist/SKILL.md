---
name: backend-integration-specialist
description: Prisma schema, Redis-backed seed/nonce state, game service dispatch, and API routes with transactional bet processing. Use when implementing or modifying persistence, concurrency, or how games get wired into the API.
---

## When to use this skill

Persistence and service-layer wiring: `prisma/schema.prisma`, the Redis-backed
`seedService`, the `gameService` that dispatches bets to game modules and
records them transactionally, and the API routes that expose all of this.

## References

- `references/schema.prisma` — canonical schema. `User` has `bets: Bet[]` and
  `seeds: RevealedSeed[]` relations already wired; prefer this over any
  looser outline (e.g. storing seed state as a raw `Json?` blob on `User`)
  seen in earlier drafts.
- `references/seedService.ts` — canonical Redis-backed seed state: lazy
  seed creation on first access, client seed rotation (resets nonce),
  server seed rotation (archives to `previousSeeds`), and nonce increment.
- `references/gameService.ts` — canonical bet-processing transaction shape.
  **This is intentionally incomplete** — treat the gaps below as a checklist,
  not something to silently work around:
  - Only `game === 'mines'` is dispatched; the other 8 games need branches
    (or, better, a lookup table of `game -> calculate* function` instead of
    an if/else chain).
  - `multiplier = 2` is a hardcoded placeholder — real multiplier must come
    from the game's payout formula (see `game-logic-engineer`'s
    `house-edge-payouts.ts`), applied to the actual outcome, not a constant.
  - `incrementNonce(userId)` is called but not awaited — this is a real bug:
    if the process crashes between the transaction commit and the increment
    resolving, the nonce can be reused. Await it, and consider moving it
    inside the same transaction/lock as the bet write.
- `references/package.json` — dependency baseline (`@prisma/client`, `ioredis`,
  `bullmq`, `express`, `zod`, `next`, etc.).

## Hard rules

- All balance-changing operations (debit, credit, bet insert) go inside one
  `prisma.$transaction`.
- Nonce increments are atomic (Redis `INCR`) and must be awaited before the
  bet is considered finalized.
- Seed rotation must hold a lock (e.g. Redlock) so it can't race an in-flight
  bet against the seed being rotated.
- Never expose or persist a raw, still-active server seed anywhere the
  player (or logs) can read it — only its hash, until it's rotated into
  `RevealedSeed`.
