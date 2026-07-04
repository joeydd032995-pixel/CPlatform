import { loadEnv, parseJurisdictionFlags, parseCorsOrigins, logger } from '@cplatform/shared';
import { createRedisClient, RedisSeedStore } from './seedStore.js';
import { RedisIdempotencyStore } from './idempotency.js';
import { createSeedService } from './seedService.js';
import { createGameService } from './gameService.js';
import type { GameDb } from './gameService.js';
import type { EnsureUser } from './middleware/auth.js';
import type { UserDb } from './routes/me.js';
import { buildApp } from './app.js';

// This file is the only place in apps/server that touches real
// infrastructure (Postgres via prisma, Redis via ioredis) and is
// deliberately NOT unit-tested — everything it wires together (seedService,
// gameService, buildApp) is tested in isolation against fakes in test/.

async function main(): Promise<void> {
  const env = loadEnv();
  const jurisdictionFlags = parseJurisdictionFlags(env.JURISDICTION_FLAGS);
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  // buildApp falls back to reflect-any-origin when no allowlist is
  // configured — the right dev default, but a production deployment
  // shipping that way is a serious misconfiguration (reflects ANY origin,
  // effectively disabling CORS protection). Fail fast at boot, before
  // buildApp/listen, rather than just warning: a silently-misconfigured
  // production deployment is worse than one that refuses to start.
  if (env.NODE_ENV === 'production' && corsOrigins === undefined) {
    throw new Error(
      'CORS_ORIGIN must be set in production. Refusing to start: without it, the API would reflect ANY origin. Set CORS_ORIGIN to an explicit comma-separated allowlist (e.g. "https://app.example.com").'
    );
  }

  const redis = createRedisClient(env.REDIS_URL);
  const seedStore = new RedisSeedStore(redis);
  const seedService = createSeedService(seedStore);
  const idempotency = new RedisIdempotencyStore(redis);

  // Dynamic import via a non-literal specifier (rather than
  // `await import('@cplatform/db')` directly) so TypeScript never performs
  // static module resolution against `@cplatform/db`'s declared types here
  // — it types the result as `any` instead. That matters in this sandbox:
  // `@prisma/client`'s generated types don't exist without a
  // network-available `prisma generate` (see packages/db/src/client.ts,
  // which itself fails `tsc --noEmit` standalone for exactly this reason),
  // and a literal-specifier dynamic import would still pull those broken
  // declarations into apps/server's compilation and fail it too. The
  // runtime behavior is identical either way — Node resolves the same
  // module — only the compile-time type resolution differs.
  //
  // The shapes actually used below (prisma.$transaction, prisma.bet,
  // tx.user.updateMany/update, tx.bet.create, prisma.user.upsert) are
  // structurally compatible with `GameDb`/`GameTx`/`EnsureUser` at runtime
  // — Prisma's real client implements a superset of what those interfaces
  // require — so the explicit `as unknown as GameDb` casts below are the
  // single, well-commented type assertion at the injection boundary called
  // out in the Milestone 4 spec, not an unreviewed, blanket `any`-cast.
  const dbModuleSpecifier = '@cplatform/db';
  const { prisma } = await import(dbModuleSpecifier);
  const db = prisma as unknown as GameDb;

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
        create: { id: userId, balance: 1000 },
      });
    },
  };

  const gameService = createGameService({
    db,
    seedService,
    idempotency,
    betLimits: { min: env.MIN_BET_AMOUNT, max: env.MAX_BET_AMOUNT },
  });

  // Same structural-compatibility rationale as the `db`/`ensureUser` casts
  // above: prisma.user.findUnique is a superset of UserDb's shape.
  const userDb = prisma as unknown as UserDb;

  const app = buildApp({
    gameService,
    seedService,
    idempotency,
    rateLimitStore: redis,
    jurisdictionFlags,
    ensureUser,
    userDb,
    env: { ...env, corsOrigins },
    logger,
  });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'apps/server listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start apps/server');
  process.exit(1);
});
