import { Router } from 'express';
import { z } from 'zod';
import type { SeedService } from '../seedService.js';
import type { IdempotencyStore } from '../idempotency.js';

const ClientSeedBodySchema = z.object({
  clientSeed: z.string().min(1).max(64),
});

export interface SeedsRouterDeps {
  seedService: SeedService;
  // Rotation is naturally close to idempotent in intent, but a double
  // rotation from a blind client retry would still burn/reveal a seed
  // early. Guard it with the same idempotency store when an
  // Idempotency-Key header is present; if the caller doesn't send one,
  // rotation is allowed to proceed unconditionally (matches the spec's
  // "simpler" fallback).
  idempotency: IdempotencyStore | null;
}

export function createSeedsRouter(deps: SeedsRouterDeps): Router {
  const router = Router();
  const { seedService, idempotency } = deps;

  router.get('/', async (req, res, next) => {
    try {
      const userId = req.userId as string;
      const state = await seedService.getPublicSeedState(userId);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  router.post('/rotate', async (req, res, next) => {
    try {
      const userId = req.userId as string;
      const idempotencyKey = req.header('idempotency-key') ?? undefined;

      if (idempotencyKey && idempotency) {
        const begun = await idempotency.begin(userId, idempotencyKey);
        if (begun === 'pending') {
          res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT', error: 'Rotation already in progress' });
          return;
        }
        if (typeof begun === 'object') {
          res.status(200).json(JSON.parse(begun.cached));
          return;
        }
      }

      const revealed = await seedService.rotateServerSeed(userId);

      if (idempotencyKey && idempotency) {
        await idempotency.complete(userId, idempotencyKey, JSON.stringify(revealed));
      }

      res.status(200).json(revealed);
    } catch (err) {
      next(err);
    }
  });

  router.post('/client-seed', async (req, res, next) => {
    try {
      const userId = req.userId as string;
      const body = ClientSeedBodySchema.parse(req.body);
      await seedService.updateClientSeed(userId, body.clientSeed);
      const state = await seedService.getPublicSeedState(userId);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
