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
  seen in earlier drafts. `Bet.multiplier` is `Decimal`, not `Float` — exact
  precision matters here since a bet's recorded multiplier must replay
  deterministically for independent verification.
- `references/seedService.ts` — canonical Redis-backed seed state: lazy
  seed creation on first access, client seed rotation (resets nonce),
  server seed rotation (archives to `previousSeeds`), and nonce increment.
  Fixed here after code review: first-time seed creation now uses
  `SET ... NX` so two concurrent first-time bets can't race and strand a
  seed's hash with no raw seed ever stored; `getSeedState` merges the live
  `nonce:${userId}` counter back into `currentNonce` on every read, since
  incrementing that counter used to have no effect on the value everything
  else reads; and the Redis client has an `.on('error', ...)` handler so a
  connection blip doesn't crash the process. **Still an open gap**:
  `updateClientSeed`/`rotateServerSeed` still do a plain get→mutate→set, so
  they can race each other or an in-flight bet — needs a Lua compare-and-set
  or a distributed lock (e.g. Redlock) around rotation, not fixed here since
  it's a bigger, coupled change.
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
  - `options.idempotencyKey` is accepted but never enforced — a retried
    request currently double-mutates balance. Needs a Redis-backed
    "already processed this key" short-circuit before any mutation.
  - The nonce is read via `getSeedState` *before* `$transaction` opens, so
    two concurrent bets for the same user can read the same nonce and
    produce colliding RNG outputs — needs a per-user lock spanning the
    nonce-read-through-bet-write, coupled to the seed-service locking gap
    above.
  - Fixed here after code review: the balance decrement is now conditional
    (`updateMany` with a `balance: { gte: betAmount }` guard, checking rows
    affected) so a bet can no longer drive a balance negative; `betAmount`
    is validated as positive before anything runs.
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
