import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from '@cplatform/shared';
import type { createGameService } from './gameService.js';
import type { SeedService } from './seedService.js';
import type { IdempotencyStore } from './idempotency.js';
import type { RateLimitCounter } from './middleware/rateLimit.js';
import type { EnsureUser } from './middleware/auth.js';
import { authStub, devEnsureUser } from './middleware/auth.js';
import { perUserRateLimit, perIpRateLimit } from './middleware/rateLimit.js';
import { createJurisdictionGate } from './middleware/jurisdiction.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createGamesRouter } from './routes/games.js';
import { createSeedsRouter } from './routes/seeds.js';
import { createVerifyRouter } from './routes/verify.js';

export interface AppDeps {
  gameService: ReturnType<typeof createGameService>;
  seedService: SeedService;
  idempotency: IdempotencyStore | null;
  rateLimitStore: RateLimitCounter;
  jurisdictionFlags: Record<string, string[]>;
  ensureUser: EnsureUser;
  env: { NODE_ENV: string };
  logger: Logger;
}

export function buildApp(deps: AppDeps): Express {
  const { gameService, seedService, idempotency, rateLimitStore, jurisdictionFlags, ensureUser, env, logger } = deps;

  const app = express();

  app.use(helmet());
  // No frontend origin exists yet (Milestone 5 hasn't started), so this
  // stays open (reflects any origin) for now. An explicit allowlist should
  // replace this once the frontend's real origin is known -- tracked as a
  // known gap, not silently accepted.
  app.use(
    cors({
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
  app.use('/api/seeds', createSeedsRouter({ seedService, idempotency }));

  app.use(errorHandler);

  return app;
}
