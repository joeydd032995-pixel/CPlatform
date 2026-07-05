# Task Plan: CPlatform UI Overhaul

## Goal
Deliver an advanced, modernized, visually appealing UI overhaul for all 9 games while preserving provably-fair contracts, API shapes, and existing test coverage.

## Phases
- [x] Phase 1: Multi-agent analysis (frontend-ui-engineer, senior-frontend, ultra-think)
- [x] Phase 2: Backend requirements documentation (frontend-to-backend-requirements)
- [x] Phase 3: Produce UI overhaul plan + PR roadmap
- [x] Phase 4a: PR1 — Tokens + GameShell wiring
- [x] Phase 4b: PR2 — Header + Lobby chrome
- [x] Phase 4c: PR3 — Validation + ResultOverlay
- [x] Phase 4d: PR4 — Lazy game module loading
- [x] Phase 4e: PR5 — Roulette felt/controls split
- [ ] Phase 4f: PR6–PR8 (remaining stack)
- [ ] Phase 5: Visual QA + test pass + bundle check

## Key Questions
1. Can the overhaul be frontend-only? **Yes** — no new API endpoints required for P0–P1; optional metadata endpoints for P2.
2. Why does the UI feel basic? **GameShell unused, vertical card stack, duplicate idle/outcome surfaces, neutral tokens, eager bundle.**
3. What is the highest-leverage first PR? **GameShell wiring + design tokens + lazy game loading.**

## Decisions Made
- **Stack stays**: Next.js 15 App Router, Tailwind v4, shadcn/ui, lucide-react — no MUI migration.
- **frontend-dev-guidelines adapted**: Use features/ folder, Suspense boundaries, lazy loading, no early-return loading spinners — mapped to Next.js patterns (not TanStack Router/MUI).
- **Composition over rewrite**: Registry + reveal phase machine are correct; refactor layout and surface/control split.
- **Roulette is P0**: Largest UX win; felt must move from params column to game surface.
- **Backend unchanged for MVP**: Existing `POST /api/games/:game`, seeds, verify, me endpoints suffice.

## Errors Encountered
- (none during planning)

## Status
**PR5 complete** — Roulette felt on surface, controls rail, chip stacks, GPU wheel. Next: PR6 (game fidelity batch A).