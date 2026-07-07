import { loadEnv, parseJurisdictionFlags, parseCorsOrigins, logger } from '@cplatform/shared';
import type { Express } from 'express';
import { createRedisClient, RedisSeedStore } from './seedStore.js';
import { RedisIdempotencyStore } from './idempotency.js';
import { createSeedService } from './seedService.js';
import { createGameService } from './gameService.js';
import type { GameDb } from './gameService.js';
import { createRoundService } from './roundService.js';
import type { RoundDb } from './roundService.js';
import type { EnsureUser } from './middleware/auth.js';
import type { UserDb } from './routes/me.js';
import { buildApp } from './app.js';
import {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  InMemoryRateLimitCounter,
  createInMemoryDb,
  createInMemoryRoundDb,
  createInMemoryUserDb,
  createInMemoryEnsureUser,
} from './inMemoryStores.js';

// New users are auto-provisioned with this balance on first request (there
// is no signup flow). One constant shared by both the real-Postgres and
// demo-mode wiring below so the two can't drift apart.
const STARTING_BALANCE = 11000;

// Extracted from index.ts so the same wiring is shared between the local
// dev entrypoint (index.ts, which calls app.listen()) and the Vercel
// serverless entrypoint (api/index.ts, which exports the app directly for
// Vercel's Node.js runtime to invoke per-request) -- both need identical
// Redis/Postgres/service construction, just a different final step.
//
// This is the only place in apps/server that touches real infrastructure
// (Postgres via prisma, Redis via ioredis) and is deliberately NOT
// unit-tested -- everything it wires together (seedService, gameService,
// buildApp) is tested in isolation against fakes in test/.
export async function createApp(): Promise<Express> {
  const env = loadEnv();
  const jurisdictionFlags = parseJurisdictionFlags(env.JURISDICTION_FLAGS);
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  // buildApp falls back to reflect-any-origin when no allowlist is
  // configured -- the right dev default, but a production deployment
  // shipping that way is a serious misconfiguration (reflects ANY origin,
  // effectively disabling CORS protection). Fail fast at boot, before
  // buildApp/listen, rather than just warning: a silently-misconfigured
  // production deployment is worse than one that refuses to start.
  if (env.NODE_ENV === 'production' && corsOrigins === undefined) {
    throw new Error(
      'CORS_ORIGIN must be set in production. Refusing to start: without it, the API would reflect ANY origin. Set CORS_ORIGIN to an explicit comma-separated allowlist (e.g. "https://app.example.com").'
    );
  }

  const betLimits = { min: env.MIN_BET_AMOUNT, max: env.MAX_BET_AMOUNT };
  const appEnv = { ...env, NODE_ENV: env.NODE_ENV ?? 'development', corsOrigins };

  // DEMO_MODE: run the entire platform against in-memory stores -- no
  // Postgres, no Redis, nothing to provision. Every visitor is
  // auto-provisioned with the starting balance and can play all 9 games;
  // provably-fair seed commitment/rotation/verification all work normally
  // within one process. The trade-off (also documented in DEPLOYMENT.md and
  // inMemoryStores.ts): all state resets on restart, and on serverless
  // platforms it is NOT shared across concurrently-warm instances. For
  // trying the games out only -- never for real money.
  if (env.DEMO_MODE) {
    logger.warn(
      'DEMO_MODE=true: running on in-memory stores (no Postgres/Redis). All balances, bets, rounds, and seed history reset on restart and are not shared across serverless instances.'
    );
    const seedService = createSeedService(new InMemorySeedStore());
    const idempotency = new InMemoryIdempotencyStore();
    const db = createInMemoryDb();
    const roundDb = createInMemoryRoundDb(db);
    return buildApp({
      gameService: createGameService({ db, seedService, idempotency, betLimits }),
      roundService: createRoundService({ db: roundDb, seedService, idempotency, betLimits }),
      seedService,
      idempotency,
      rateLimitStore: new InMemoryRateLimitCounter(),
      jurisdictionFlags,
      ensureUser: createInMemoryEnsureUser(db, STARTING_BALANCE),
      userDb: createInMemoryUserDb(db),
      env: appEnv,
      logger,
    });
  }

  // Non-demo mode: real persistence is mandatory. loadEnv() already
  // enforces this (DATABASE_URL/REDIS_URL are only optional when
  // DEMO_MODE=true), so this guard exists to narrow the types and to fail
  // loudly if that invariant ever regresses.
  if (!env.DATABASE_URL || !env.REDIS_URL) {
    throw new Error('DATABASE_URL and REDIS_URL are required unless DEMO_MODE=true');
  }

  const redis = createRedisClient(env.REDIS_URL);
  const seedStore = new RedisSeedStore(redis);
  const seedService = createSeedService(seedStore);
  const idempotency = new RedisIdempotencyStore(redis);

  // Dynamic import via a non-literal specifier (rather than
  // `await import('@cplatform/db')` directly) so TypeScript never performs
  // static module resolution against `@cplatform/db`'s declared types here
  // -- it types the result as `any` instead. That matters in this sandbox:
  // `@prisma/client`'s generated types don't exist without a
  // network-available `prisma generate` (see packages/db/src/client.ts,
  // which itself fails `tsc --noEmit` standalone for exactly this reason),
  // and a literal-specifier dynamic import would still pull those broken
  // declarations into apps/server's compilation and fail it too. The
  // runtime behavior is identical either way -- Node resolves the same
  // module -- only the compile-time type resolution differs.
  //
  // The shapes actually used below (prisma.$transaction, prisma.bet,
  // tx.user.updateMany/update, tx.bet.create, prisma.user.upsert) are
  // structurally compatible with `GameDb`/`GameTx`/`EnsureUser` at runtime
  // -- Prisma's real client implements a superset of what those interfaces
  // require -- so the explicit `as unknown as GameDb` casts below are the
  // single, well-commented type assertion at the injection boundary called
  // out in the Milestone 4 spec, not an unreviewed, blanket `any`-cast.
  const dbModuleSpecifier = '@cplatform/db';
  const { prisma } = await import(dbModuleSpecifier);
  const db = prisma as unknown as GameDb;
  // Same structural-compatibility rationale as the `db` cast above --
  // Prisma's real client (once `Round` is generated) is a superset of
  // RoundDb's shape.
  const roundDb = prisma as unknown as RoundDb;

  const ensureUser: EnsureUser = {
    async ensureUser(userId: string): Promise<void> {
      // Same reasoning as the `db` cast above: prisma.user.upsert is
      // structurally compatible with this minimal shape.
      const userDb = prisma as unknown as {
        user: {
          upsert(args: {
            where: { id: string };
            update: Record<string, never>;
            create: { id: string; balance: number };
          }): Promise<unknown>;
        };
      };
      await userDb.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, balance: STARTING_BALANCE },
      });
    },
  };

  const gameService = createGameService({ db, seedService, idempotency, betLimits });

  const roundService = createRoundService({ db: roundDb, seedService, idempotency, betLimits });

  // Same structural-compatibility rationale as the `db`/`ensureUser` casts
  // above: prisma.user.findUnique is a superset of UserDb's shape.
  const userDb = prisma as unknown as UserDb;

  return buildApp({
    gameService,
    roundService,
    seedService,
    idempotency,
    rateLimitStore: redis,
    jurisdictionFlags,
    ensureUser,
    userDb,
    // appEnv's `NODE_ENV ?? 'development'` handles the same class of
    // environment-only discrepancy as the helmet cast in app.ts: locally
    // (and in CI) `env.NODE_ENV` infers as required (zod's `.default()`
    // guarantees a value after parsing), but Vercel's build has resolved a
    // type where it's optional -- the fallback never fires at runtime, it
    // just satisfies AppDeps's required `NODE_ENV: string` regardless of
    // which way a given environment infers it.
    env: appEnv,
    logger,
  });
}
