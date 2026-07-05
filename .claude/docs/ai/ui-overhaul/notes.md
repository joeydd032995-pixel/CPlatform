# Notes: CPlatform UI Overhaul Research

## Sources

### frontend-ui-engineer skill
- Bet forms, viz, verify are the scope; client-side Zod mirroring is UX-only.
- GameShell + BetInput/PlayButton are canonical control vocabulary.
- Gaps: params validation before submit, typed results, idempotency awareness.

### senior-frontend audit (subagent)
- GameShell built but GamePage stacks Cards at max-w-3xl.
- games.ts eagerly imports all 18 game components on every route.
- 46 shadcn primitives installed; ~12 used.
- Mines shows fabricated running multiplier; Plinko shows slot indices not real multipliers.
- Roulette wheel is strong; felt duplicated in params + result.

### frontend-ui-engineer flow analysis (subagent)
- Target: idle → bet → dealing → revealing → done with phase-locked controls.
- ResultOverlay on surface after reveal (not buried below cards).
- Per-game control/surface split documented for all 9 games.
- reveal-timing.ts centralization recommended.

### Codebase API (apps/web/src/lib/api-client.ts)
- `POST /api/games/:game` — play bet (idempotency-key header)
- `GET /api/seeds` — seed state
- `POST /api/seeds/rotate` — reveal server seed
- `POST /api/seeds/client-seed` — set client seed
- `POST /api/verify` — public verification
- `GET /api/me` — balance + userId

### Types (apps/web/src/lib/types.ts)
- PlayGameResult: outcome, multiplier, payout, nonce, serverSeedHash
- Per-game outcomes re-exported from @cplatform/games (type-only)
- No bet history endpoint today

## Synthesized Findings

### Root cause of "basic" feel
1. Admin-form layout (vertical cards) instead of casino shell (controls | surface).
2. Duplicate game boards (Idle* in params + Viz after bet).
3. No brand typography or semantic color system (grey primary + one-off purple gradient).
4. No motion system, toasts, or skeletons.
5. Narrow viewport crushes roulette/keno/plinko.

### What NOT to change
- HMAC-SHA256 provably-fair flow (seeds → nonce → verify).
- Server one-shot bet model (full outcome in single response).
- Staged reveal is client-side pacing only — never invent outcomes.
- HiLo ≥/≤ semantics, roulette European edge, blackjack RTP (CLAUDE.md).

### Performance hotspots
- Eager gamesRegistry imports (High)
- Roulette 37 DOM labels + 3.5s spin (Medium)
- Plinko setInterval peg animation (Medium)
- Verify page loads all Vizzes (High)

### Guideline adaptations (frontend-dev-guidelines → CPlatform)

| Guideline (MUI stack) | CPlatform equivalent |
|-----------------------|----------------------|
| features/ directory | `src/features/{shell,games,lobby,fairness}/` |
| useSuspenseQuery | Keep useUser + fetch in client; add route `loading.tsx` skeletons |
| SuspenseLoader | Next.js `<Suspense>` + skeleton components |
| Lazy routes | `next/dynamic` per game module via `loadGameModule()` |
| No early returns | Skeleton placeholders in fixed layout slots |
| useMuiSnackbar | shadcn `sonner` Toaster in layout |