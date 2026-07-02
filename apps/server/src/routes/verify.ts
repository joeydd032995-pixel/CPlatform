import { Router } from 'express';
import { z } from 'zod';
import { RNGOptionsSchema, hashServerSeed } from '@cplatform/core-rng';
import type { GeneratorOptions } from '@cplatform/core-rng';
import { GameDispatchTable } from '@cplatform/games';
import type { GameName } from '@cplatform/games';
import { UnknownGameError } from '@cplatform/shared';

const GAME_NAMES = Object.keys(GameDispatchTable) as GameName[];

const VerifyBodySchema = RNGOptionsSchema.extend({
  game: z.enum(GAME_NAMES as [GameName, ...GameName[]]),
  params: z.unknown(),
});

// PUBLIC route — no auth, no userId, no balance mutation. Anyone holding a
// revealed server seed (post-rotation) can recompute a bet's outcome
// independently and compare it against what was recorded.
export function createVerifyRouter(): Router {
  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const body = VerifyBodySchema.parse(req.body);
      const { game, params, serverSeed, clientSeed, nonce } = body;

      if (!(GAME_NAMES as string[]).includes(game)) {
        throw new UnknownGameError(game);
      }
      const handler = GameDispatchTable[game];

      const generatorOpts: GeneratorOptions = { serverSeed, clientSeed, nonce };
      // betAmount fixed at 1 so payout === multiplier exactly (no house
      // money involved in this computation — this route never touches a
      // balance).
      const { outcome, multiplier } = handler.resolve(generatorOpts, params, 1);

      res.status(200).json({
        verified: true,
        game,
        nonce,
        serverSeedHash: hashServerSeed(serverSeed),
        outcome,
        multiplier,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
