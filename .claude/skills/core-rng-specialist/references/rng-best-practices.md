# RNG Best Practices

- **Commitment**: publish `SHA256(serverSeed)` before the seed is used for any
  bet. This is the industry-standard scheme (Stake, Roobet, etc.) — verifiable
  by anyone with just the seed and a SHA256 implementation, no HMAC details
  required to check the commitment itself.
- **Generation**: byte/float streams are HMAC-SHA256(`serverSeed`, message)
  where `message = ${clientSeed}:${nonce}:${round}`. This must be
  deterministic: identical inputs must always yield identical outputs, since
  both game logic and fairness tests depend on reproducibility.
- **Never log raw seeds**. A server seed must never appear in application
  logs, error messages, Sentry breadcrumbs/tags, or any DB column outside the
  dedicated `RevealedSeed.serverSeed` field (which is only populated *after*
  rotation, once the seed is no longer live).
- **Test with fixed seeds**. Every RNG-consuming function should have at
  least one test that pins `serverSeed`/`clientSeed`/`nonce` and asserts an
  exact expected output — this catches accidental algorithm drift.
- **Version discipline**. The `version` field in `RNGOptionsSchema` exists so
  the generation algorithm can evolve without invalidating old, already-played
  bets. Bumping it means: keep the old version's generator function
  available and dispatch on `version` at verification time.
- **Client seed handling**: bound length (max 64 chars) and allow the player
  to rotate it freely (resets nonce to 0) — this is what gives the player
  agency in the fairness scheme, distinct from the server seed which only
  they can't see until reveal.
- **Nonce**: strictly increasing per (serverSeed, clientSeed) pair, starting
  at 0. Must be incremented atomically server-side (see
  `backend-integration-specialist`'s seed service) — a skipped or repeated
  nonce breaks the ability to replay/verify a specific bet.
