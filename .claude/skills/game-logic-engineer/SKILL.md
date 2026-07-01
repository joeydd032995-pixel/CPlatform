---
name: game-logic-engineer
description: Individual game modules (Mines, Plinko, Dice, Roulette, Keno, Blackjack, HiLo, Chicken, Darts) built on the RNG core's float/byte generators. Use when implementing, fixing, or extending a specific game's outcome or payout logic.
---

## When to use this skill

Any task about a single game's outcome-generation or payout math. RNG
primitives come from `core-rng-specialist`'s core (`createFloatGenerator`,
`createByteGenerator`) — never call `Math.random()` or reimplement HMAC
logic here.

## Ground truth: Snippets.txt overrides the older design docs

`references/deck.ts` and `references/games/*.ts` are **verbatim real
production code** (originally from nuts.gg), reviewed and confirmed correct.
Earlier AI-drafted docs (`1stReviewDoc.txt`, `FinalReviewDoc.txt`) claimed
Blackjack and HiLo shuffle a virtual deck via deterministic Fisher-Yates
**without replacement**. That claim is **wrong**. The real algorithm draws
each card **independently, with replacement**:

```ts
const cardId = Math.floor(float * deck.length); // 0-51, every draw
```

up to 29 times for Blackjack, up to 52 times for HiLo — there is no shrinking
deck and no shuffle. Do not "correct" this back to a shuffle-based approach;
the shuffle description in the older docs was speculative and never matched
real behavior.

## What's provided vs. what's still needed

| Game | Outcome generator | Payout/multiplier math |
|---|---|---|
| Mines | ✅ `games/mines.ts` (position draw) | ❌ needs combinatorial payout table |
| Plinko | ✅ `games/plinko.ts` | ✅ full multiplier tables included |
| Dice | ✅ `games/dice.ts` | ❌ needs multiplier-from-target formula |
| Roulette | ✅ `games/roulette.ts` | ❌ needs bet-type payout table (straight/split/color/etc.) |
| Keno | ✅ `games/keno.ts` (hit positions) | ❌ needs hit-count paytable |
| Blackjack | ✅ `games/blackjack.ts` | ❌ needs hand-evaluation + payout |
| HiLo | ✅ `games/hilo.ts` | ❌ needs per-guess multiplier from remaining-card odds |
| Chicken | ✅ `games/chicken.ts` (death point) | ❌ needs per-lane multiplier curve |
| Darts | ✅ `games/darts.ts` (polar coords) | ❌ needs zone-to-multiplier mapping |

`references/house-edge-payouts.ts` has the shared `applyHouseEdge`/`expectedRTP`
helpers to build these payout formulas on top of.

## Conventions

- Keep outcome generation (`calculate*`) and payout/multiplier logic
  (`resolve*`) as separate functions so each can be unit-tested independently.
- Reject invalid parameters at the function boundary (e.g. Dice target
  outside 0.01–99.99, Mines count outside 1–24, Keno picks outside 1–10)
  rather than letting them silently produce nonsense output.
- All exported functions should be pure — no I/O, no DB/Redis access. Persistence
  and dispatch belong to `backend-integration-specialist`.
