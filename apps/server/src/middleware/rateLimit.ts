import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '@cplatform/shared';

// @cplatform/shared doesn't define a 429 error (rate limiting is an
// apps/server concern, not a shared domain concept), so it's defined
// locally here rather than modifying the shared package.
export class RateLimitError extends AppError {
  readonly httpStatus = 429;
  readonly code = 'RATE_LIMITED';

  constructor() {
    super('Too many requests');
  }
}

// Narrow interface so this can be backed by a real ioredis client or an
// in-memory fake in tests without depending on ioredis's full type surface.
export interface RateLimitCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  // Derives the identity to key the limiter on (e.g. userId or IP). Return
  // null/undefined to skip rate limiting for this request (e.g. no userId
  // yet because auth ran later, or an unresolvable IP).
  keyFn: (req: Request) => string | undefined;
  scope: string;
}

export function createRateLimit(
  counter: RateLimitCounter,
  options: RateLimitOptions
): RequestHandler {
  const { windowSeconds, max, keyFn, scope } = options;

  return function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const id = keyFn(req);
    if (!id) {
      next();
      return;
    }

    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `rl:${scope}:${id}:${window}`;

    counter
      .incr(key)
      .then(async (count) => {
        if (count === 1) {
          await counter.expire(key, windowSeconds);
        }
        if (count > max) {
          next(new RateLimitError());
          return;
        }
        next();
      })
      .catch(next);
  };
}

export function perUserRateLimit(counter: RateLimitCounter, options: Omit<RateLimitOptions, 'keyFn' | 'scope'>): RequestHandler {
  return createRateLimit(counter, {
    ...options,
    scope: 'user',
    keyFn: (req) => req.userId,
  });
}

export function perIpRateLimit(counter: RateLimitCounter, options: Omit<RateLimitOptions, 'keyFn' | 'scope'>): RequestHandler {
  return createRateLimit(counter, {
    ...options,
    scope: 'ip',
    keyFn: (req) => req.ip,
  });
}
