# CPlatform UI Overhaul Plan

**Status:** Ready for implementation  
**Scope:** All 9 games + lobby + seeds + verify  
**Agents consulted:** frontend-ui-engineer, senior-frontend, ultra-think, frontend-dev-guidelines (adapted), frontend-to-backend-requirements

---

## Executive Summary

The platform has strong foundations — provably-fair backend, a complete game registry, reveal phase machine, shadcn/ui primitives, and a well-built `GameShell` — but they are **not composed into a cohesive product**. The UI reads as a vertical admin form (`max-w-3xl` card stack) instead of a casino session (controls rail + immersive game surface).

**Recommendation:** A phased frontend-only overhaul centered on **GameShell composition**, **design system tokens**, **lazy per-game bundles**, and **per-game surface/control splits** — starting with Roulette, Mines, and Plinko.

**Backend impact:** None required for P0–P1. See [backend-requirements.md](./backend-requirements.md).

---

## Problem Analysis

### Core challenge
Transform a functionally complete provably-fair demo into a **visually premium, casino-grade** experience without breaking fairness contracts, API shapes, or existing Vitest coverage.

### Key constraints
- Next.js 15 App Router + Tailwind v4 + shadcn/ui (no MUI migration)
- `@cplatform/games` runtime cannot be imported in web bundle (Node `crypto`) — types only
- Server returns **full outcome in one shot**; staged reveal is client-side pacing only
- CLAUDE.md sacred rules: HiLo ≥/≤ model, roulette European edge, blackjack card draw with replacement
- Auth is header stub; balance auto-created on first play

### Critical success factors
1. Single game surface per screen (no duplicate idle + outcome boards)
2. Phase-locked controls during deal/reveal
3. Semantic design tokens (brand, win, lose, surfaces)
4. Code-split game modules (one game loaded per route)
5. All 9 games pass existing `GamePage.test.tsx` reveal → ResultPanel flow

---

## Ultra-Think: Solution Options

### Option 1: Composition Refactor (GameShell-first)
**Description:** Wire existing `GameShell` into `GamePage`; extract controls vs surface; add tokens + typography. Minimal new dependencies.

| Pros | Cons |
|------|------|
| Fastest path to "feels like a casino" | Doesn't fix every animation gap in one pass |
| Low risk; preserves tests | Requires disciplined per-game surface splits |
| Uses code already in repo | Roulette felt split is non-trivial |

**Risk:** Medium — Roulette refactor could regress multi-bet tests if felt geometry drifts.

---

### Option 2: Full Design System + Feature Re-architecture
**Description:** New `features/` tree, lazy registry, shared motion system, prune 30+ unused shadcn components, canvas renderers for Plinko/Roulette.

| Pros | Cons |
|------|------|
| Best long-term maintainability | 2–3× implementation time |
| Smaller bundles after prune | Higher regression surface |
| Canvas/SVG fixes perf hotspots | Canvas harder to test with RTL |

**Risk:** High scope creep if not phased.

---

### Option 3: Visual Skin Only (CSS + homepage)
**Description:** New fonts, colors, hero lobby, polish Header — leave GamePage card stack intact.

| Pros | Cons |
|------|------|
| Very fast | **Does not fix** duplicate boards, cramped roulette, basic game UX |
| Low test risk | User's "poorly designed" complaint largely remains |

**Risk:** Low — but fails the stated goal.

---

### Adversarial test (Option 1 — recommended)
**How it fails badly:**
- Roulette felt extraction breaks bet placement geometry → invalid bets or wrong payouts displayed
- Lazy loading causes flash of empty surface → layout shift
- Removing fabricated Mines multiplier confuses users who relied on it as narrative (not authoritative)

**Mitigations:**
- Keep roulette overlay math in shared `lib/roulette-felt.ts` (no re-derivation)
- `loading.tsx` skeleton matches GameShell dimensions
- Show authoritative `result.multiplier` only in ResultOverlay after reveal

### Cross-domain insight
Premium game UIs (chess.com, stake.com) separate **decision rail** (narrow, scrollable) from **board surface** (wide, fixed aspect). CPlatform's `GameShell` already encodes this pattern — the product skipped the last mile of wiring it.

### Second-order effects (6 months)
- **Option 1:** Easier to add game #10; consistent verify/seed chrome
- **Option 2:** Lower bundle; faster mobile; higher onboarding cost for contributors
- **Option 3:** Design debt compounds; roulette remains unusable on mobile

### Confidence calibration

| Claim | Confidence | What would change it |
|-------|------------|----------------------|
| GameShell wiring is highest leverage | **High** | User wants lobby-only polish |
| Frontend-only for P0–P1 | **High** | Product demands bet history in header |
| Roulette split is P0 | **High** | Decision to defer roulette visual work |
| Canvas Plinko needed now | **Low** | Profiling shows DOM path is fine on target devices |

---

## Recommended Approach

**Option 1 + selective Option 2 elements** (features folder, lazy loading, sonner toasts, motion tokens) delivered as a **7-PR stack**.

### Design direction: "Refined Noir Casino"
- **Palette:** Charcoal neutrals (existing) + violet brand accent + semantic win/lose
- **Typography:** Geist Sans + Geist Mono (or DM Sans + JetBrains Mono) via `next/font`
- **Surfaces:** Glass-elevated cards, `surface-game` stage, subtle radial brand glow on body
- **Motion:** 150ms micro, 300ms reveals, game-specific durations in `reveal-timing.ts`
- **Density:** Wider game routes (`max-w-6xl`); narrow for seeds/verify (`max-w-4xl`)

---

## Target Architecture

```text
src/
├── app/                          # Thin routes + loading.tsx skeletons
├── components/ui/                # shadcn primitives (trim unused in P2)
├── features/
│   ├── shell/
│   │   ├── GameShell.tsx
│   │   ├── GamePage.tsx
│   │   ├── GameControls.tsx
│   │   ├── GameSurface.tsx
│   │   ├── GameSessionHeader.tsx
│   │   ├── ResultOverlay.tsx
│   │   ├── ResultSummary.tsx
│   │   └── DealingSkeleton.tsx
│   ├── games/
│   │   ├── registry.ts           # metadata + loadGameModule()
│   │   ├── types.ts              # VizProps, IdlePreviewProps
│   │   ├── mines/ | plinko/ | …  # params + viz per game
│   ├── lobby/
│   │   └── GameCard.tsx
│   └── fairness/
│       ├── VerifyForm.tsx
│       └── SeedManager.tsx
└── lib/
    ├── games.ts                  # re-exports types + GAME_NAMES
    ├── game-meta.ts              # icons, descriptions, accents
    ├── reveal-timing.ts
    └── roulette-felt.ts          # shared felt geometry (split from params)
```

### frontend-dev-guidelines adaptations

| Principle | Implementation |
|-----------|----------------|
| features/ organization | `features/shell`, `features/games`, `features/lobby`, `features/fairness` |
| Lazy load heavy components | `loadGameModule(game)` dynamic import per route |
| Suspense boundaries | `app/games/[game]/loading.tsx` + `<Suspense>` around GamePage |
| No early-return spinners | Fixed-layout skeletons in shell slots |
| useCallback for handlers | GameControls event handlers |
| TypeScript strict | Promote `VizProps<O,P>` to shared types; no new `any` |

---

## Per-Game Control / Surface Split

| Game | Controls (rail) | Surface (stage) |
|------|-----------------|-----------------|
| **Mines** | Mines slider, picks input | 5×5 grid (idle + reveal) |
| **Plinko** | Rows slider, risk tabs | Peg pyramid + ball path |
| **Dice** | Target slider, over/under | Win zone bar + roll animation |
| **Roulette** | Chip value, bet list, clear | Wheel + interactive felt |
| **Keno** | Risk, auto/clear, pick count | 40-tile board (pick + draw modes) |
| **Chicken** | Difficulty, lanes | Lane track + character |
| **Darts** | Paytable summary | Board + throw animation |
| **HiLo** | Guess sequence builder | Card stack + flip staging |
| **Blackjack** | Rules summary | Felt table + deal sequence |

**Action:** Remove all `Idle*` previews from `*ParamsForm.tsx` once surface owns idle state.

---

## PR Roadmap (Implementation Order)

### PR1 — Foundation: Tokens + GameShell wiring
**Priority:** P0 | **Est:** 1–2 days

- [ ] `globals.css`: brand, win, lose, surface-game, motion CSS variables; `--primary` → brand violet
- [ ] `layout.tsx`: `next/font`, `<Toaster />`, antialiased body, subtle background gradient
- [ ] Move `GameShell` → `features/shell/`; widen to `max-w-6xl`
- [ ] Refactor `GamePage` → `GameShell` + `GameControls` + `GameSurface`
- [ ] Phase-lock params + bet when `dealing | revealing`
- [ ] `app/games/[game]/loading.tsx` skeleton
- [ ] Fix `verify/page.tsx` `text-slate-400` → `text-muted-foreground`

**Tests:** All existing GamePage + BetForm tests pass.

---

### PR2 — Design chrome: Header + Lobby
**Priority:** P0 | **Est:** 1 day

- [ ] `GameSessionHeader`: game title, phase badge, balance, seed snippet
- [ ] `Header`: wallet chip, tab-style nav, `tabular-nums` balance
- [ ] `features/lobby/GameCard.tsx`: icon, accent, description, hover lift
- [ ] `page.tsx`: hero section + responsive game grid
- [ ] `lib/game-meta.ts`: per-game icon/color/description

---

### PR3 — Bet flow polish: Validation + ResultOverlay
**Priority:** P0 | **Est:** 1 day

- [ ] Params Zod validation in `GameControls` before submit
- [ ] `ResultSummary` + `ResultOverlay` on surface (slide-up after reveal)
- [ ] Per-game Play labels: SPIN / DEAL / BET
- [ ] Sonner toasts for bet errors (keep inline Alert as secondary)
- [ ] `prefers-reduced-motion` hook stub

---

### PR4 — Lazy game loading
**Priority:** P0 | **Est:** 1 day

- [ ] Split `lib/games.ts` → `features/games/registry.ts` + `loadGameModule()`
- [ ] Per-game folders: move params + viz into `features/games/{name}/`
- [ ] `VerifyForm` loads viz dynamically for selected game only
- [ ] Verify bundle no longer imports all 9 Vizzes

---

### PR5 — Roulette overhaul
**Priority:** P0 | **Est:** 2–3 days

- [ ] Extract `lib/roulette-felt.ts` from `RouletteParamsForm`
- [ ] `RouletteControls` (chips, bet list) in rail
- [ ] `RouletteFelt` interactive surface (idle + post-bet highlights)
- [ ] Chip stacks on felt cells
- [ ] Mobile: horizontal scroll felt + sticky chip bar
- [ ] GPU layer on wheel spin (`will-change: transform`)

**Tests:** `GamePage.test.tsx` roulette path (chip place → spin → ResultPanel).

---

### PR6 — Game fidelity + staged reveals (batch A)
**Priority:** P1 | **Est:** 2–3 days

- [ ] `lib/reveal-timing.ts` — single source of intervals
- [ ] **Mines:** Remove fabricated multiplier; show server multiplier in overlay only
- [ ] **Plinko:** Real multiplier labels on slots (from params/risk config)
- [ ] **Dice:** Staged count-up roll; honor `staged` prop
- [ ] **Keno:** Replace native `<select>`; sequential draw animation
- [ ] **HiLo:** Card flip CSS transitions

---

### PR7 — Game fidelity + staged reveals (batch B)
**Priority:** P1 | **Est:** 2 days

- [ ] **Blackjack:** Staged deal sequence, felt background
- [ ] **Darts:** Throw animation along rotation/distance
- [ ] **Chicken:** Lane character marker + death pulse
- [ ] `DealingSkeleton` per-game variants
- [ ] `use-reveal-sequence.ts` shared hook (replace duplicate setInterval)

---

### PR8 — Fairness pages + cleanup (P2)
**Priority:** P2 | **Est:** 1–2 days

- [ ] `SeedManager` + `VerifyForm`: PageShell layout, responsive tables
- [ ] Verify: optional game-aware params tab (keep JSON advanced tab)
- [ ] Prune unused shadcn components + dead npm deps
- [ ] `components.json` formalized

---

## Viz Component Contract (mandatory)

```typescript
type GameVizProps<O, P> = {
  outcome: O;           // fully determined — never invented
  params: P;
  staged?: boolean;     // true → animate then call onRevealComplete once
  onRevealComplete?: () => void;
};
```

| Rule | Requirement |
|------|-------------|
| `staged=false` | Final state immediately; call `onRevealComplete` on mount |
| `staged=true` | Animate from t=0; cleanup timers on unmount |
| Reduced motion | Skip animation; instant final state |
| Payout authority | Only `ResultOverlay` shows final payout/multiplier |
| Test IDs | Preserve existing `data-testid` attributes |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Visual | Single surface per game; no duplicate idle/outcome boards |
| Functional | All Vitest suites pass (`apps/web`) |
| Performance | Game route JS chunk excludes other games' viz code |
| Accessibility | `prefers-reduced-motion` respected; viz `role="img"` + `aria-label` |
| Mobile | Roulette felt usable (scroll or stacked layout) |
| Fairness | Verify deep links unchanged; no client-side outcome invention |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Roulette geometry regression | Shared `roulette-felt.ts`; run `params.parity.test.ts` + GamePage roulette test |
| Layout shift on lazy load | Fixed-dimension skeleton in `loading.tsx` |
| Bundle regressions | Measure `next build` per PR; document chunk sizes |
| Animation jank on mobile | GPU transforms; cap Plinko steps under reduced motion |
| Scope creep | Strict PR boundaries; P2 items explicitly deferred |

---

## What We Will NOT Do (this overhaul)

- Migrate to MUI or TanStack Router
- Add real auth / payments UI
- Change RNG, payout, or house-edge logic
- Invent server round-trips for multi-step games
- Add RTP disclosure page (deferred per CLAUDE.md compliance item)

---

## Next Step

Approve this plan (or specify priorities), then begin **PR1 — Foundation: Tokens + GameShell wiring**.

**Plan artifacts:**
- [task_plan.md](./task_plan.md) — phase tracker
- [notes.md](./notes.md) — research synthesis
- [backend-requirements.md](./backend-requirements.md) — API needs (frontend-only for P0–P1)