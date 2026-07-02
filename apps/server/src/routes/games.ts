import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { createGameService } from '../gameService.js';

const PlayBodySchema = z.object({
  betAmount: z.number().positive().finite(),
  params: z.unknown(),
});

export interface GamesRouterDeps {
  gameService: ReturnType<typeof createGameService>;
  // Applied on the `/:game` route itself (rather than on the router's mount
  // path in app.ts) so that `req.params.game` is already populated by the
  // time this runs — a middleware mounted at the fixed `/api/games` prefix
  // would run before Express resolves the `:game` param.
  jurisdictionGate?: RequestHandler;
}

export function createGamesRouter(deps: GamesRouterDeps): Router {
  const router = Router();
  const { gameService, jurisdictionGate } = deps;

  const middlewares: RequestHandler[] = jurisdictionGate ? [jurisdictionGate] : [];

  router.post('/:game', ...middlewares, async (req, res, next) => {
    try {
      const body = PlayBodySchema.parse(req.body);
      const idempotencyKey = req.header('idempotency-key') ?? undefined;
      const userId = req.userId;
      if (!userId) {
        // Should be unreachable in practice — authStub runs before this
        // route is mounted and always sets req.userId or short-circuits.
        res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Missing user id' });
        return;
      }

      const result = await gameService.playGame({
        userId,
        betAmount: body.betAmount,
        game: req.params.game as string,
        params: body.params,
        idempotencyKey,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
