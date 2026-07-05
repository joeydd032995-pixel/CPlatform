import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { createRoundService } from '../roundService.js';

const StartMinesBodySchema = z.object({
  betAmount: z.number().positive().finite(),
  mines: z.number().int().min(1).max(24),
});

const StartBlackjackBodySchema = z.object({
  betAmount: z.number().positive().finite(),
});

const VersionBodySchema = z.object({
  version: z.number().int().min(0),
});

const BlackjackActionBodySchema = z.object({
  version: z.number().int().min(0),
  action: z.enum(['hit', 'stand', 'double', 'split', 'insurance']),
});

// Same bound as routes/games.ts's IdempotencyKeyHeaderSchema, same rationale.
const IdempotencyKeyHeaderSchema = z.string().max(128).optional();

export interface RoundsRouterDeps {
  roundService: ReturnType<typeof createRoundService>;
  jurisdictionGate?: RequestHandler;
}

export function createRoundsRouter(deps: RoundsRouterDeps): Router {
  const router = Router();
  const { roundService, jurisdictionGate } = deps;
  const middlewares: RequestHandler[] = jurisdictionGate ? [jurisdictionGate] : [];

  function requireUserId(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]): string | null {
    const userId = req.userId;
    if (!userId) {
      // Should be unreachable in practice -- authStub runs before this
      // router is mounted and always sets req.userId or short-circuits.
      res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Missing user id' });
      return null;
    }
    return userId;
  }

  router.post('/mines/start', ...middlewares, async (req, res, next) => {
    try {
      const body = StartMinesBodySchema.parse(req.body);
      const idempotencyKey = IdempotencyKeyHeaderSchema.parse(req.header('idempotency-key') ?? undefined);
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.startMinesRound({
        userId,
        betAmount: body.betAmount,
        mines: body.mines,
        idempotencyKey,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/mines/:id/reveal', ...middlewares, async (req, res, next) => {
    try {
      const body = VersionBodySchema.parse(req.body);
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.minesReveal({
        userId,
        roundId: req.params.id as string,
        expectedVersion: body.version,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/mines/:id/cash-out', ...middlewares, async (req, res, next) => {
    try {
      const body = VersionBodySchema.parse(req.body);
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.minesCashOut({
        userId,
        roundId: req.params.id as string,
        expectedVersion: body.version,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/blackjack/start', ...middlewares, async (req, res, next) => {
    try {
      const body = StartBlackjackBodySchema.parse(req.body);
      const idempotencyKey = IdempotencyKeyHeaderSchema.parse(req.header('idempotency-key') ?? undefined);
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.startBlackjackRound({
        userId,
        betAmount: body.betAmount,
        idempotencyKey,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/blackjack/:id/action', ...middlewares, async (req, res, next) => {
    try {
      const body = BlackjackActionBodySchema.parse(req.body);
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.blackjackAction({
        userId,
        roundId: req.params.id as string,
        expectedVersion: body.version,
        action: body.action,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', ...middlewares, async (req, res, next) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await roundService.getRound({ userId, roundId: req.params.id as string });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
