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

// Minimal shape needed to auto-provision a user the first time we see their
// id, so there's no separate signup flow. Real wiring (createApp.ts)
// implements this via `prisma.user.upsert`.
export interface EnsureUser {
  ensureUser(userId: string): Promise<void>;
}

// Auto-provisions a starting balance for any never-seen-before user id, in
// every environment including production -- this auth stub has no signup
// flow to fall back to, so gating provisioning by NODE_ENV would just leave
// production visitors with no account and no way to get one. This is only
// safe because the auth stub already trusts a client-supplied `x-user-id`
// header everywhere (see authStub above); real session-based auth replacing
// that stub (the top pre-launch blocker tracked in CLAUDE.md) is what should
// gate account creation behind a real signup flow, not NODE_ENV.
export function ensureUserMiddleware(deps: EnsureUser): RequestHandler {
  return function ensureUserMiddlewareHandler(req: Request, res: Response, next: NextFunction): void {
    if (!req.userId) {
      next();
      return;
    }
    deps
      .ensureUser(req.userId)
      .then(() => next())
      .catch(next);
  };
}
