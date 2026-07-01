# Deployment Checklist & Skeletons

## docker-compose.yml (skeleton, from FinalReviewDoc.txt)

```yaml
services:
  api:
    build: .
    env_file: .env
    depends_on: [db, redis]
  db:
    image: postgres:16
  redis:
    image: redis:7
```

Expand with: multi-stage Node build, separate services for API/worker/frontend,
Zod-validated environment config loaded at container start.

## CI (`.github/workflows/ci.yml`)

Pipeline stages, in order, each gating the next:
1. Lint
2. Typecheck
3. Unit tests (including fairness/statistical tests — see
   `fairness-test-template.ts`)
4. `prisma migrate deploy` against an ephemeral test DB
5. Build
6. (optional) Deploy preview

## Production checklist

- **Idempotency**: `Idempotency-Key` header + Redis cache on bet-placement
  and seed-rotation endpoints.
- **Tracing**: OpenTelemetry with context propagation across API → game
  service → DB.
- **Compliance**: jurisdiction feature flags (e.g.
  `enabledGames: { us: ["mines"], eu: ["all"] }`).
- **Archival**: partition the `Bet` table by timestamp; move old rows to
  cold storage on a schedule.
- **DR**: target RPO < 5 min, RTO < 15 min via read replicas + regular
  backups.
- **Monitoring**: Sentry for errors, Prometheus for metrics (bet volume,
  RTP drift alerts, RNG latency).
