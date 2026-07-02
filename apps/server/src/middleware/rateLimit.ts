import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError, logger } from '@cplatform/shared';

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
// `eval` (matching ioredis's built-in Redis#eval signature) rather than
// separate incr/expire methods: a plain INCR-then-EXPIRE pair isn't atomic
// -- a crash between the two calls leaves the key permanently un-expiring,
// which would either lock a caller out forever (if it happened on the
// first hit of a window) or let the counter never reset. A single Lua
// script closes that gap the same way seedStore.ts's scripts do.
export interface RateLimitCounter {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

const INCR_WITH_EXPIRE_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

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
      .eval(INCR_WITH_EXPIRE_LUA, 1, key, windowSeconds)
      .then((count) => {
        if (Number(count) > max) {
          next(new RateLimitError());
          return;
        }
        next();
      })
      .catch((err) => {
        // Rate limiting is a secondary protection, not core correctness --
        // a transient Redis hiccup here should degrade gracefully (allow
        // the request through) rather than turn into a full outage of the
        // betting API for every gated route.
        logger.warn({ err, scope, id }, 'Rate limit store error; failing open');
        next();
      });
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
