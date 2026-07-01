---
name: core-rng-specialist
description: Provably-fair RNG core — HMAC-SHA256 byte/float generation, SHA256 seed commitment, seed rotation. Use when implementing or modifying core/rng.ts, hashing/commitment logic, or seed generation/rotation.
---

## When to use this skill

Any task touching the RNG core itself: byte/float generators, server/client
seed generation, hash commitment, or the validated `RNGOptions` shape used at
the API boundary. Game-specific outcome logic is out of scope — that belongs
to `game-logic-engineer`.

## How to extend safely

1. Read `references/provably-fair-core.ts` first — it's the canonical,
   already-reconciled implementation combining the Zod-validated envelope
   type with the leaner internal generator shape used by game modules.
2. Read `references/rng-best-practices.md` for the non-negotiable rules
   (commitment scheme, logging policy, determinism, versioning).
3. Never change the byte/float derivation algorithm in place — that breaks
   verification of every historical bet. If a change is truly needed, add a
   new `version` and keep the old generator path alive.
4. Any new consumer of the RNG (a new game, a new API route) should import
   `createByteGenerator` / `createFloatGenerator` and the seed/hash helpers
   from this module rather than re-implementing HMAC logic locally.
