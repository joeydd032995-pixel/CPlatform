# Security & Compliance Audit Checklist

## Seed exposure
- Raw server seed never appears in logs, error messages, Sentry
  breadcrumbs/tags, or any DB column/query outside `RevealedSeed.serverSeed`
  (only populated post-rotation).
- API responses never include an active (unrevealed) server seed — only its
  hash.
- Client seed length is bounded (max 64 chars) and sanitized before storage.

## Concurrency on nonces
- Nonce increments use an atomic primitive (Redis `INCR`), never a
  read-then-write pattern that could race under concurrent requests.
- Nonce increments are awaited before a bet is considered finalized — a
  fire-and-forget increment can be lost on crash, enabling nonce reuse.
- Seed rotation acquires a lock (e.g. Redlock) so it cannot race an
  in-flight bet using the seed being rotated.

## Input validation
- Every API boundary validates input with Zod (or equivalent) before it
  reaches game/business logic — no raw `req.body` fields used directly.
- Game-specific parameter bounds are enforced (Dice target range, Mines
  count range, Keno pick count, bet amount min/max, etc.) — impossible or
  degenerate parameter combinations are rejected, not silently clamped.
- `betAmount` is validated as a positive number within account
  balance/platform limits before any balance mutation occurs.

## Logging policy
- No PII or financial secrets (seeds, tokens, session identifiers) in
  plaintext logs.
- Structured logging includes enough context to debug a disputed bet
  (bet id, hashed seed, nonce, game, params) without ever including the
  raw active seed.

## Idempotency & rate limiting
- Mutating endpoints (place bet, rotate seed) accept an `Idempotency-Key`
  and short-circuit duplicate submissions (e.g. from client retries).
- Rate limiting is applied per user and per IP on bet-placement and
  auth endpoints to blunt automated abuse.

## Compliance & responsible gaming
- House edge / RTP is disclosed somewhere reachable by the player (required
  in a number of jurisdictions).
- Session limits / reality-check prompts exist for responsible gaming.
- Feature flags exist to disable specific games or the platform entirely
  per jurisdiction (e.g. `enabledGames: { us: [...], eu: [...] }`).

## Data lifecycle
- Bet history and revealed seeds are retained per whatever data-retention
  policy applies, and can be exported for a fairness dispute.
- Old bet data has a documented archival/cold-storage path as volume grows.
