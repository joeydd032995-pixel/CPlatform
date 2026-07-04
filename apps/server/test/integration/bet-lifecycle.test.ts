import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// This suite exercises the real stack: real ioredis + real Postgres (via
// @cplatform/db's prisma client). It only runs in CI, where those services
// are provisioned as part of the workflow — GitHub Actions sets `CI=true`
// automatically, so gating on that env var is a reliable local/dev
// skip switch. In this sandbox (no live Redis/Postgres, and `@prisma/client`
// generated types don't even resolve without a network-available
// `prisma generate`), this entire suite is skipped and apps/server's
// typecheck/test scripts stay green without touching real infra.
//
// The dynamic `await import('@cplatform/db')` below (rather than a
// top-level import) is deliberate: it keeps this file's module-level shape
// free of a dependency on generated Prisma types, so `tsc --noEmit` over
// apps/server doesn't require `prisma generate` to have run, even though
// this file itself only executes when CI provides real infra.
describe.skipIf(!process.env.CI)('bet lifecycle (integration)', () => {
  let app: Express;
  let userId: string;
  let redisClient: import('ioredis').Redis;

  beforeAll(async () => {
    const { loadEnv, parseJurisdictionFlags, parseCorsOrigins, logger } = await import('@cplatform/shared');
    const { createRedisClient, RedisSeedStore } = await import('../../src/seedStore.js');
    const { RedisIdempotencyStore } = await import('../../src/idempotency.js');
    const { createSeedService } = await import('../../src/seedService.js');
    const { createGameService } = await import('../../src/gameService.js');
    const { buildApp } = await import('../../src/app.js');
    const dbModule = await import('@cplatform/db');

    const env = loadEnv();
    const jurisdictionFlags = parseJurisdictionFlags(env.JURISDICTION_FLAGS);
    const redis = createRedisClient(env.REDIS_URL);
    redisClient = redis;
    const seedStore = new RedisSeedStore(redis);
    const seedService = createSeedService(seedStore);
    const idempotency = new RedisIdempotencyStore(redis);

    // Single, well-commented type assertion at the injection boundary —
    // see src/index.ts for the identical rationale.
    const db = dbModule.prisma as unknown as import('../../src/gameService.js').GameDb;
    const ensureUser = {
      async ensureUser(id: string): Promise<void> {
        const userDb = dbModule.prisma as unknown as {
          user: { upsert(args: unknown): Promise<unknown> };
        };
        await userDb.user.upsert({
          where: { id },
          update: {},
          create: { id, balance: 1000 },
        });
      },
    };

    const gameService = createGameService({ db, seedService, idempotency });

    // Single, well-commented type assertion at the injection boundary --
    // see src/index.ts for the identical rationale.
    const userDb = dbModule.prisma as unknown as import('../../src/routes/me.js').UserDb;

    app = buildApp({
      gameService,
      seedService,
      idempotency,
      rateLimitStore: redis,
      jurisdictionFlags,
      ensureUser,
      userDb,
      env: { ...env, corsOrigins: parseCorsOrigins(env.CORS_ORIGIN) },
      logger,
    });

    userId = `integration-user-${Date.now()}`;
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('runs the full lifecycle: client-seed -> bet -> seeds -> rotate -> verify', async () => {
    await request(app)
      .post('/api/seeds/client-seed')
      .set('x-user-id', userId)
      .send({ clientSeed: 'integration-test-client-seed' })
      .expect(200);

    const betRes = await request(app)
      .post('/api/games/dice')
      .set('x-user-id', userId)
      .send({ betAmount: 10, params: { target: 50, direction: 'under' } })
      .expect(200);

    const seedsBefore = await request(app)
      .get('/api/seeds')
      .set('x-user-id', userId)
      .expect(200);
    expect(seedsBefore.body.nonce).toBeGreaterThan(0);

    const rotateRes = await request(app)
      .post('/api/seeds/rotate')
      .set('x-user-id', userId)
      .expect(200);

    const verifyRes = await request(app)
      .post('/api/verify')
      .send({
        serverSeed: rotateRes.body.serverSeed,
        clientSeed: 'integration-test-client-seed',
        nonce: betRes.body.nonce,
        version: '1.1',
        game: 'dice',
        params: { target: 50, direction: 'under' },
      })
      .expect(200);

    expect(verifyRes.body.outcome).toEqual(betRes.body.outcome);
    expect(verifyRes.body.serverSeedHash).toBe(rotateRes.body.serverSeedHash);
  });

  it('handles 20-way concurrency against real Redis without nonce collisions', async () => {
    const concurrentUserId = `integration-concurrent-${Date.now()}`;
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/games/dice')
          .set('x-user-id', concurrentUserId)
          .send({ betAmount: 1, params: { target: 50, direction: 'under' } })
      )
    );

    for (const res of responses) expect(res.status).toBe(200);
    const nonces = new Set(responses.map((r) => r.body.nonce));
    expect(nonces.size).toBe(20);
  });
});
