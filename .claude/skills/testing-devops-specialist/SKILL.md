---
name: testing-devops-specialist
description: Fairness/statistical testing, CI/CD, and deployment artifacts. Use when writing tests (especially statistical fairness tests for a game), setting up CI, or producing Docker/deploy configs.
---

## When to use this skill

Test coverage across the platform, with special emphasis on **statistical
fairness testing** for game outcome generators, plus CI/CD and deployment
artifacts.

## References

- `references/fairness-test-template.ts` — chi-square uniformity test and
  Monte Carlo `simulateRTP` helper. Every game module needs:
  1. A **determinism test**: fixed `serverSeed`/`clientSeed`/`nonce` produces
     an exact, hand-verifiable expected output.
  2. A **distribution test**: run N rounds (N large, e.g. 10,000+) with
     varying nonces and confirm the outcome distribution is statistically
     uniform (or matches the intended probability weighting) via chi-square.
  3. For payout-bearing games, an **RTP test**: `simulateRTP` over many
     rounds should converge close to the game's `expectedRTP()`.
- `references/deployment-checklist.md` — Docker Compose + CI skeleton.

## Testing rules

- Fairness tests must use fixed, known seeds — never `Math.random()` or
  time-based seeds — so failures are reproducible and diffable.
- Integration tests should cover the full bet lifecycle: place bet → hash
  recorded → outcome computed → payout applied → seed revealed →
  independent verification round-trip succeeds using only public data
  (server seed, hash, client seed, nonce).
- Roulette's color-mapping (flagged as unverified in
  `game-logic-engineer/references/games/roulette.ts`) needs an explicit
  test asserting each of the 37 numbers against the real European wheel's
  known red/black assignment, not just "some plausible mapping".
- CI (see `deployment-checklist.md`) must run lint, typecheck, unit +
  fairness tests, and `prisma migrate` against a test DB before merge.
