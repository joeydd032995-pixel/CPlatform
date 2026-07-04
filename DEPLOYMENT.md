# Running CPlatform locally

This brings up the whole provably-fair gaming platform — Postgres, Redis, the
Express API, and the Next.js web app — with a single command, so you can open
it in a browser and play.

> **Demo/dev configuration.** This compose setup runs the API in
> `NODE_ENV=development` on purpose: the auth stub then auto-creates your user
> with a starting balance the first time you play, so there's nothing to seed.
> It is **not** production-hardened — auth is a header stub, the session secret
> is a placeholder, and CORS reflects any origin. See the pre-launch items in
> `CLAUDE.md` before exposing this anywhere real.

## Prerequisites

- Docker with the Compose plugin (`docker compose version` should print v2+).
- Outbound internet for the first build: the API image runs `prisma generate`,
  which downloads a query-engine binary. (This is the one step that can't run
  in the project's egress-blocked build sandbox — it works on any normal
  machine.)

## Start it

```bash
docker compose up --build
```

The first build takes a few minutes (`npm ci`, `prisma generate`, `next build`).
When it settles, open:

- **Web app → http://localhost:3000** — this is what you want. Pick a game,
  place bets, manage your seeds, and verify outcomes.
- API (if you want to poke at it directly) → http://localhost:4000, e.g.
  `curl http://localhost:4000/healthz`.

On startup the API applies the initial database migration automatically
(`prisma migrate deploy`). The web app reaches the API through Next's
server-side proxy (`/api/*` → the `api` service), so your browser only ever
talks to `localhost:3000`.

## Try the fairness flow

1. Open http://localhost:3000 and choose a game (e.g. Dice or Mines).
2. Place a bet — your identity and starting balance are created automatically.
3. Go to the **Seeds** page, note the active server-seed hash, then **rotate**
   the seed to reveal the previous raw server seed.
4. On the **Verify** page (also reachable from a bet's result), plug in the
   revealed server seed + your client seed + the bet's nonce and confirm the
   outcome recomputes to exactly what you were paid — the provably-fair
   guarantee, checked independently of the server.

## Stop / reset

```bash
docker compose down        # stop everything, keep the database volume
docker compose down -v     # also wipe Postgres data (fresh start)
```

## Notes & troubleshooting

- **Ports in use?** The published ports (3000, 4000, 5432, 6379) are bound to
  `127.0.0.1`. If one is taken, edit the `ports:` mapping in
  `docker-compose.yml`.
- **Rebuild after code changes:** `docker compose up --build` again. The db
  volume persists across rebuilds unless you pass `-v` to `down`.
- **Services only (run the apps yourself):** `docker compose up db redis`
  starts just Postgres + Redis (published on localhost); then run the API and
  web with `npm` on the host using `.env` (copy from `.env.example`). Useful
  for active development with hot reload.
- **First real migration run:** the initial Prisma migration was hand-authored
  and, because the build sandbox had no database, has not been applied against
  a live Postgres until now. `docker compose up` is where it first runs for
  real — if anything in the schema/migration is off, the API container's logs
  are where you'll see it.
