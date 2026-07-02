import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '@cplatform/shared';

export class GameNotAvailableError extends AppError {
  readonly httpStatus = 403;
  readonly code = 'GAME_NOT_AVAILABLE';

  constructor(game: string, jurisdiction: string) {
    super(`${game} is not available in jurisdiction ${jurisdiction}`);
  }
}

// ---------------------------------------------------------------------------
// STUB jurisdiction gating — reads a client-supplied `x-jurisdiction`
// header. Like auth.ts, this trusts the client; real geo/compliance gating
// (IP geolocation, KYC-derived jurisdiction, etc.) is out of scope here.
//
// Dev-friendly default: if the header is absent, JURISDICTION_FLAGS parses
// to an empty object, or the specific jurisdiction has no entry, every game
// is allowed. Only an explicit, non-empty allow-list for a jurisdiction
// restricts anything — this is deliberate so local/dev/testing never needs
// a header just to hit game routes.
// ---------------------------------------------------------------------------
export function createJurisdictionGate(flags: Record<string, string[]>): RequestHandler {
  return function jurisdictionMiddleware(req: Request, res: Response, next: NextFunction): void {
    const game = req.params.game;
    const jurisdiction = req.header('x-jurisdiction');

    if (!jurisdiction || Object.keys(flags).length === 0) {
      next();
      return;
    }

    const allowed = flags[jurisdiction];
    if (!allowed) {
      next();
      return;
    }

    if (allowed.includes('all') || (game && allowed.includes(game))) {
      next();
      return;
    }

    next(new GameNotAvailableError(game ?? 'unknown', jurisdiction));
  };
}
