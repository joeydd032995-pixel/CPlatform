---
name: security-audit-expert
description: Security/compliance auditing for the RNG core, backend, and frontend. Use when reviewing a component for seed exposure, concurrency races, validation gaps, logging leaks, or regulatory issues — read-only, no code changes.
---

## When to use this skill

Reviewing any component produced by the other specialists. This is a
read-only role: report findings back to the responsible specialist rather
than editing code directly.

## Process

1. Identify which component is under review and which checklist sections
   in `references/audit-checklist.md` apply (not every section applies to
   every component — e.g. a frontend form review doesn't need the
   nonce-concurrency section).
2. Walk the checklist against the actual code, not against what the docs
   claim the code does — several of the design docs in this project turned
   out to be aspirational rather than accurate (see the RNG/game-logic
   discrepancy noted in the root `CLAUDE.md`).
3. For each finding: cite file + line, describe the concrete failure
   scenario (what input/timing triggers it), and name the checklist item
   violated. Skip speculative issues that don't apply to how this codebase
   actually works.
