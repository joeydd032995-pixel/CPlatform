import { Router } from 'express';
import { z } from 'zod';
import { RNGOptionsSchema, hashServerSeed } from '@cplatform/core-rng';
import type { GeneratorOptions } from '@cplatform/core-rng';
import { GameDispatchTable } from '@cplatform/games';
import type { GameName } from '@cplatform/games';
import { UnknownGameError } from '@cplatform/shared';
import { replayMinesRound, replayBlackjackRound } from '../roundVerify.js';

const GAME_NAMES = Object.keys(GameDispatchTable) as GameName[];

const VerifyBodySchema = RNGOptionsSchema.extend({
  game: z.enum(GAME_NAMES as [GameName, ...GameName[]]),
  params: z.unknown(),
});

// Round actions carry extra bookkeeping fields (hitMine, revealedCount,
// timestamps, ...) that this route doesn't need -- only `type` drives the
// replay, so extra fields are allowed through rather than re-validated here.
const RoundActionLogEntrySchema = z.object({ type: z.string() }).passthrough();

const VerifyRoundBodySchema = RNGOptionsSchema.extend({
  game: z.enum(['mines', 'blackjack']),
  startParams: z.unknown(),
  actionLog: z.array(RoundActionLogEntrySchema),
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

  // Round-aware replay for Mines cash-out / Blackjack real-time decisions:
  // given the revealed seed material plus the round's recorded decision
  // history, replays those exact decisions through the same pure primitives
  // roundService used to produce the original result, and returns the
  // final state for direct comparison. Unlike the one-shot route above,
  // this recomputes "the one result of this exact decision sequence," not
  // "the one true outcome of this seed/nonce" -- the same seed/nonce can
  // legitimately produce a whole family of results depending on what the
  // player chose at each step (see roundVerify.ts's file comment for why
  // that's still fully fair and verifiable).
  router.post('/round', (req, res, next) => {
    try {
      const body = VerifyRoundBodySchema.parse(req.body);
      const { game, startParams, actionLog, serverSeed, clientSeed, nonce } = body;
      const generatorOpts: GeneratorOptions = { serverSeed, clientSeed, nonce };

      const result =
        game === 'mines'
          ? replayMinesRound(generatorOpts, startParams, actionLog)
          : replayBlackjackRound(generatorOpts, actionLog);

      res.status(200).json({
        verified: true,
        game,
        nonce,
        serverSeedHash: hashServerSeed(serverSeed),
        ...result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
