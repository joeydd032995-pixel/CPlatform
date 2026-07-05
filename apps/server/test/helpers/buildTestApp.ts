import type { Express } from 'express';
import { logger } from '@cplatform/shared';
import { buildApp } from '../../src/app.js';
import type { AppDeps } from '../../src/app.js';
import { createSeedService } from '../../src/seedService.js';
import { createGameService } from '../../src/gameService.js';
import { createRoundService } from '../../src/roundService.js';
import {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  createFakeDb,
  createFakeRoundDb,
  createFakeUserDb,
  createFakeEnsureUser,
} from './inMemoryStores.js';
import type { RateLimitCounter } from '../../src/middleware/rateLimit.js';

// A rate-limit counter fake that never throttles -- these tests exercise
// routing/auth/CORS wiring, not the rate limiter (which already has its own
// dedicated unit tests), so always resolving under `max` keeps that
// concern out of the way here.
function createNeverLimitingRateLimitStore(): RateLimitCounter {
  return {
    async eval() {
      return 1;
    },
  };
}

export interface TestAppHarness {
  app: Express;
  db: ReturnType<typeof createFakeDb>;
  roundDb: ReturnType<typeof createFakeRoundDb>;
}

export function buildTestApp(overrides: Partial<AppDeps['env']> = {}): TestAppHarness {
  const seedStore = new InMemorySeedStore();
  const seedService = createSeedService(seedStore);
  const idempotency = new InMemoryIdempotencyStore();
  const db = createFakeDb();
  const roundDb = createFakeRoundDb(db);
  const ensureUser = createFakeEnsureUser(db);
  const userDb = createFakeUserDb(db);
  const gameService = createGameService({ db, seedService, idempotency });
  const roundService = createRoundService({ db: roundDb, seedService, idempotency });

  const app = buildApp({
    gameService,
    roundService,
    seedService,
    idempotency,
    rateLimitStore: createNeverLimitingRateLimitStore(),
    jurisdictionFlags: {},
    ensureUser,
    userDb,
    env: { NODE_ENV: 'test', ...overrides },
    logger,
  });

  return { app, db, roundDb };
}
