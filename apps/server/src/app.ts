import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from '@cplatform/shared';
import type { createGameService } from './gameService.js';
import type { createRoundService } from './roundService.js';
import type { SeedService } from './seedService.js';
import type { IdempotencyStore } from './idempotency.js';
import type { RateLimitCounter } from './middleware/rateLimit.js';
import type { EnsureUser } from './middleware/auth.js';
import { authStub, devEnsureUser } from './middleware/auth.js';
import { perUserRateLimit, perIpRateLimit } from './middleware/rateLimit.js';
import { createJurisdictionGate } from './middleware/jurisdiction.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createGamesRouter } from './routes/games.js';
import { createRoundsRouter } from './routes/rounds.js';
import { createSeedsRouter } from './routes/seeds.js';
import { createVerifyRouter } from './routes/verify.js';
import { createMeRouter } from './routes/me.js';
import type { UserDb } from './routes/me.js';

export interface AppDeps {
  gameService: ReturnType<typeof createGameService>;
  roundService: ReturnType<typeof createRoundService>;
  seedService: SeedService;
  idempotency: IdempotencyStore | null;
  rateLimitStore: RateLimitCounter;
  jurisdictionFlags: Record<string, string[]>;
  ensureUser: EnsureUser;
  userDb: UserDb;
  // corsOrigins is undefined when CORS_ORIGIN isn't set in the environment
  // (see packages/shared/src/env.ts's parseCorsOrigins) -- that preserves
  // the previous reflect-any-origin dev behavior. Once set, it's an
  // explicit allowlist and anything not in it gets no ACAO header at all.
  env: { NODE_ENV: string; corsOrigins?: string[] };
  logger: Logger;
}

export function buildApp(deps: AppDeps): Express {
  const {
    gameService,
    roundService,
    seedService,
    idempotency,
    rateLimitStore,
    jurisdictionFlags,
    ensureUser,
    userDb,
    env,
    logger,
  } = deps;

  const app = express();

  // helmet's default export is a plain CJS `module.exports = helmet`
  // function. Locally (and in CI) TypeScript's esModuleInterop correctly
  // types `helmet` as that callable function, but Vercel's build-time
  // type-check resolves the same import to the CJS module's namespace
  // type instead (no call signatures) -- a resolution-mode discrepancy
  // between environments, not a runtime difference; `helmet()` is called
  // identically either way. Cast narrowly at the one call site rather than
  // changing the import (which works correctly everywhere else).
  app.use((helmet as unknown as () => express.RequestHandler)());
  // Milestone 5: the frontend's real origin(s) are now configurable via the
  // CORS_ORIGIN env var (comma-separated, parsed by
  // packages/shared/src/env.ts's parseCorsOrigins). When it's unset,
  // `corsOrigins` is undefined and this falls back to `origin: true`, which
  // is the same reflect-any-origin dev behavior as before -- still a known
  // gap for any deployment that hasn't set CORS_ORIGIN yet, but no longer
  // the only option.
  app.use(
    cors({
      origin: env.corsOrigins ?? true,
      allowedHeaders: ['Content-Type', 'x-user-id', 'idempotency-key', 'x-jurisdiction'],
    })
  );
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      // x-user-id and idempotency-key are caller-controlled identifiers,
      // not secrets, but there's no reason to let them accumulate in log
      // storage verbatim either -- redact at the http-log layer the same
      // way @cplatform/shared's logger redacts seed material elsewhere.
      redact: {
        paths: ['req.headers["x-user-id"]', 'req.headers["idempotency-key"]'],
        censor: '[redacted]',
      },
    })
  );

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Public, unauthenticated: anyone with a revealed seed can recompute and
  // verify a bet's outcome. Mounted before auth on purpose, but still
  // IP-rate-limited -- being unauthenticated is exactly why it needs its
  // own throttle instead of relying on the per-user limiter below (which
  // never applies here, since there's no req.userId yet).
  app.use('/api/verify', perIpRateLimit(rateLimitStore, { windowSeconds: 10, max: 200 }), createVerifyRouter());

  app.use(authStub);
  app.use(devEnsureUser(ensureUser, env.NODE_ENV));
  app.use(perUserRateLimit(rateLimitStore, { windowSeconds: 10, max: 50 }));
  app.use(perIpRateLimit(rateLimitStore, { windowSeconds: 10, max: 200 }));

  app.use(
    '/api/games',
    createGamesRouter({ gameService, jurisdictionGate: createJurisdictionGate(jurisdictionFlags) })
  );
  app.use(
    '/api/rounds',
    createRoundsRouter({ roundService, jurisdictionGate: createJurisdictionGate(jurisdictionFlags) })
  );
  app.use('/api/seeds', createSeedsRouter({ seedService, idempotency }));
  app.use('/api/me', createMeRouter({ userDb }));

  app.use(errorHandler);

  return app;
}
