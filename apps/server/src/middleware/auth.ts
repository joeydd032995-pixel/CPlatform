import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ---------------------------------------------------------------------------
// STUB AUTH — NOT PRODUCTION AUTHENTICATION.
//
// This trusts a client-supplied `x-user-id` header as-is. There is no
// session, no token verification, no signature check — anyone can claim to
// be any user by setting this header. It exists purely so the rest of the
// stack (rate limiting, jurisdiction gating, game/seed routes) has a
// `req.userId` to key off of during Milestone 4 development and testing.
//
// Before this platform handles real money, this file MUST be replaced with
// real session/token-based authentication (e.g. signed JWT or server-side
// session lookup) that the caller cannot forge.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authStub(req: Request, res: Response, next: NextFunction): void {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Missing x-user-id header' });
    return;
  }
  req.userId = userId;
  next();
}

// Minimal shape needed to auto-provision a dev/test user the first time we
// see their id, so local/dev/testing doesn't require a separate signup
// flow. Real production wiring (src/index.ts) implements this via
// `prisma.user.upsert`.
export interface EnsureUser {
  ensureUser(userId: string): Promise<void>;
}

// Auto-provisions a starting balance for any never-seen-before user id, but
// ONLY outside production — in production, account creation should go
// through a real signup flow, not be implicitly created by whatever id a
// caller happens to send.
export function devEnsureUser(deps: EnsureUser, nodeEnv: string): RequestHandler {
  return function devEnsureUserMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (nodeEnv === 'production' || !req.userId) {
      next();
      return;
    }
    deps
      .ensureUser(req.userId)
      .then(() => next())
      .catch(next);
  };
}
