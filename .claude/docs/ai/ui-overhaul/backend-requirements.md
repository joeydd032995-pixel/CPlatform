# Backend Requirements: UI Overhaul (All Games)

## Context

The frontend is undergoing a casino-grade visual overhaul across all 9 games (Mines, Plinko, Dice, Roulette, Keno, Chicken, Darts, HiLo, Blackjack), plus lobby, seeds, and verify flows. This document describes **what the UI needs from backend** — not how to implement it. Backend owns API design; frontend owns presentation.

**Who uses it:** Anonymous/demo players via header-stub identity (`x-user-id`).

**Goal:** Rich, trustworthy player experience without changing provably-fair guarantees.

---

## Screens/Components

### Game Session (all 9 games)

**Purpose:** Configure bet → place bet → watch staged reveal → see payout → verify.

**Data I need to display:**
- Current balance (before and after bet)
- Active server seed hash (committed, not revealed)
- Client seed in use for upcoming bets
- Per-game outcome structure exactly as returned today (mines positions, roulette wheel number + per-bet breakdown, hilo step sequence, etc.)
- Final payout, multiplier, nonce, server seed hash for the bet just placed
- Validation errors when params or bet amount are invalid

**Actions:**
- Place bet with game-specific params → receive full outcome in one response
- Retry same bet on network failure without creating duplicate (idempotency)
- Refresh balance after bet or insufficient-balance error

**States to handle:**
- **Empty/idle:** No result yet; show preview board from params only
- **Loading:** Bet in flight; lock controls, show dealing skeleton
- **Revealing:** Outcome known but animating; lock controls
- **Complete:** Show payout overlay + verify link
- **Error:** Friendly message per error code (insufficient balance, invalid params, rate limit, jurisdiction block)

**Business rules affecting UI:**
- Roulette total stake = sum of chip amounts on felt (not free-typed bet amount)
- Bet amount must be positive; optional platform min/max from env
- Games may be disabled per jurisdiction header
- Server seed for active bets is hash-only until rotation

**Uncertainties:**
- [ ] Should the UI show a live "max payout" preview before bet? (Would need server-side multiplier preview or documented client formula)
- [ ] Are there per-game bet limits beyond global MIN/MAX? (Product decision)

---

### Lobby (home page)

**Purpose:** Discover and launch games.

**Data I need to display:**
- List of available games for this jurisdiction
- Human-readable game name
- Optional: short description, house edge / RTP, "new" badge
- Whether game is enabled or greyed out

**Actions:**
- Navigate to game route

**States:**
- **Loading:** Jurisdiction flags not yet known
- **Empty:** No games enabled for jurisdiction (edge case)

**Questions for Backend:**
- Would it make sense to expose game metadata (label, RTP, enabled) from a single catalog endpoint instead of hardcoding on frontend?
- Should disabled games be hidden or shown as locked?

---

### Seeds page

**Purpose:** Manage provably-fair seed material.

**Data I need to display:**
- Active server seed hash, client seed, current nonce
- History of rotated seeds with revealed server seed, hash, client seed, final nonce, rotation timestamp

**Actions:**
- Set client seed (1–64 chars)
- Rotate server seed → previous seed revealed, new hash committed

**States:**
- **Loading:** Fetching seed state
- **Error:** Rotation or client-seed update failed
- **Empty history:** No previous seeds yet

**Business rules:**
- Verification deep links need revealed server seed — only available after rotation for bets on that seed era

---

### Verify page

**Purpose:** Independently recompute a bet outcome.

**Data I need to display:**
- Recomputed outcome, multiplier, server seed hash match confirmation
- Same viz as game page (instant, non-staged)

**Actions:**
- Submit server seed + client seed + nonce + game + params → verification result

**States:**
- **Invalid input:** Per-field validation (64-char hex server seed, etc.)
- **Success:** Verified badge + outcome viz
- **Error:** Server rejection message

**No new backend needs** — existing public verify route suffices.

---

### Wallet / Header chrome

**Purpose:** Persistent identity and balance across pages.

**Data I need to display:**
- User identifier (truncated)
- Current balance with stable decimal formatting

**Actions:**
- Copy user id
- Generate new identity (client-side) → triggers new user on next API call

**Questions for Backend:**
- Will balance always be a plain number over the wire? (Today yes; UI will use tabular-nums formatting)
- Any plan for bet history? UI would benefit from "recent bets" in header dropdown — not required for P0.

---

## Optional Enhancements (P2 — invite pushback)

### Game catalog metadata
If backend could expose per-game display metadata (RTP, max multiplier, enabled flag), the lobby could stay in sync without frontend deploys. **Not blocking** — frontend can hardcode from CLAUDE.md conventions initially.

### Bet history
A list of recent bets per user would power:
- Quick "verify last bet" from header
- Session recap panel

**Not required** for overhaul P0–P1. Frontend will use per-bet verify links from ResultOverlay.

### Live odds preview
For Mines/Plinko/Keno, showing expected multiplier before bet may require server-computed preview or documented payout tables. **Frontend will not invent payout math** — either use existing game module formulas (type-only) or skip preview until backend confirms approach.

---

## Discussion Log

| Date | Note |
|------|------|
| 2026-07-04 | Initial requirements drafted during UI overhaul planning. **Conclusion: P0–P1 overhaul is frontend-only** against existing API. Optional catalog + bet history are P2 nice-to-haves. |