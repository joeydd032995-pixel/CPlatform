import { Router } from 'express';

// Narrow persistence contract, same rationale as GameDb in ../gameService.ts:
// `prisma generate` cannot run in this sandbox, so this route depends on a
// hand-written interface structurally compatible with the real Prisma
// client rather than `@prisma/client`'s generated model delegate types.
// `balance` is typed `unknown` here (mirrors BetRecord's betAmount/payout)
// because Prisma's `Decimal` type isn't available without the generated
// client either -- callers must go through `Number(...)` before returning
// it over the wire (see below).
export interface UserDb {
  user: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; balance: unknown } | null>;
  };
}

export interface MeRouterDeps {
  userDb: UserDb;
}

export function createMeRouter(deps: MeRouterDeps): Router {
  const router = Router();
  const { userDb } = deps;

  router.get('/', async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        // Should be unreachable in practice -- authStub runs before this
        // router is mounted and always sets req.userId or short-circuits.
        res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Missing user id' });
        return;
      }

      const user = await userDb.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found' });
        return;
      }

      // Prisma's Decimal serializes to a string/object with unhelpful
      // default JSON output; Number(...) gives callers a plain JS number as
      // documented for this endpoint.
      res.status(200).json({ userId: user.id, balance: Number(user.balance) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
