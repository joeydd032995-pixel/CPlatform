import { GameDispatchTable } from '@cplatform/games';
import type { GameName } from '@cplatform/games';
import type { GeneratorOptions } from '@cplatform/core-rng';
import {
  InsufficientBalanceError,
  UnknownGameError,
  IdempotencyConflictError,
} from '@cplatform/shared';
import type { SeedService } from './seedService.js';
import type { IdempotencyStore } from './idempotency.js';

// Narrow persistence contract. Deliberately NOT importing `@prisma/client`
// types here: `prisma generate` cannot run in this sandbox (network-blocked
// engine download), so the generated client's model delegate types don't
// resolve. Depending on this narrow, hand-written interface instead means
// (a) apps/server typechecks today without a generated client, and (b) the
// real prisma client (which is structurally compatible with this shape)
// can be passed in at the composition root in src/index.ts with a single,
// well-commented type assertion — see that file.
export type BetRecord = {
  id: string;
  userId: string;
  game: string;
  betAmount: unknown;
  payout: unknown;
  multiplier: unknown;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  outcome: unknown;
  params: unknown;
  idempotencyKey?: string | null;
};

export interface GameTx {
  user: {
    updateMany(args: {
      where: { id: string; balance: { gte: number } };
      data: { balance: { decrement: number } };
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: { balance: { increment: number } };
    }): Promise<unknown>;
  };
  bet: {
    create(args: {
      data: {
        userId: string;
        game: string;
        betAmount: number;
        payout: number;
        multiplier: number;
        serverSeedHash: string;
        clientSeed: string;
        nonce: number;
        outcome: unknown;
        params: unknown;
        idempotencyKey: string | null;
      };
    }): Promise<BetRecord>;
  };
}

export interface GameDb {
  $transaction<T>(fn: (tx: GameTx) => Promise<T>): Promise<T>;
  bet: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<BetRecord | null>;
  };
}

// `Bet.idempotencyKey` is a single globally-unique DB column (see
// packages/db/prisma/schema.prisma) rather than a composite
// (userId, idempotencyKey) constraint. If the raw caller-supplied key were
// stored as-is, two different users reusing the same key string could
// collide, and the DB-level fallback below would leak one user's bet
// (outcome, payout, seed hash) to the other. Namespacing the *stored*
// value by userId gets the same effect as a composite unique constraint
// without a schema migration -- the Redis-level idempotency store already
// does exactly this (`idem:{userId}:{key}`), so this mirrors that pattern.
function storageIdempotencyKey(userId: string, idempotencyKey: string): string {
  return `${userId}:${idempotencyKey}`;
}

export interface PlayGameOptions {
  userId: string;
  betAmount: number;
  game: string;
  params: unknown;
  idempotencyKey?: string;
}

export interface PlayGameResult {
  bet: BetRecord;
  outcome: unknown;
  multiplier: number;
  payout: number;
  nonce: number;
  serverSeedHash: string;
}

export interface GameServiceDeps {
  db: GameDb;
  seedService: SeedService;
  idempotency: IdempotencyStore | null;
}

const GAME_NAMES = Object.keys(GameDispatchTable) as GameName[];

function isGameName(game: string): game is GameName {
  return (GAME_NAMES as string[]).includes(game);
}

// Duck-types Prisma's P2002 unique-constraint-violation error without
// importing the generated error class (which, again, doesn't resolve in
// this sandbox without a live `prisma generate`).
function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

export function createGameService(deps: GameServiceDeps) {
  const { db, seedService, idempotency } = deps;

  async function playGame(options: PlayGameOptions): Promise<PlayGameResult> {
    const { userId, betAmount, game, params, idempotencyKey } = options;

    // Step 1: idempotency short-circuit, before any nonce burn or mutation.
    if (idempotencyKey && idempotency) {
      const begun = await idempotency.begin(userId, idempotencyKey);
      if (begun === 'pending') {
        throw new IdempotencyConflictError();
      }
      if (typeof begun === 'object') {
        return JSON.parse(begun.cached) as PlayGameResult;
      }
    }

    // Step 2: validate the game name against the real dispatch table (no
    // unsafe cast reaching runtime) before doing anything stateful.
    if (!isGameName(game)) {
      throw new UnknownGameError(game);
    }
    const handler = GameDispatchTable[game];

    // Step 3: reserve the nonce BEFORE opening the transaction. This is a
    // deliberate tradeoff: if the transaction below aborts (e.g.
    // insufficient balance or an invalid-params throw), the reserved nonce
    // is burned and never reused. That's intentional — reusing a nonce
    // after showing its outcome (even a rejected one) to a caller would
    // break fairness guarantees, so "burn on failure" is strictly safer
    // than "risk reuse". (If a bet fails, no result is cached for its
    // idempotency key either — see step 6 — so a legitimate retry can
    // still proceed, just against a freshly reserved nonce.)
    const tuple = await seedService.reserveNextNonce(userId);
    const generatorOpts: GeneratorOptions = {
      serverSeed: tuple.serverSeed,
      clientSeed: tuple.clientSeed,
      nonce: tuple.nonce,
    };
    const storedIdempotencyKey = idempotencyKey
      ? storageIdempotencyKey(userId, idempotencyKey)
      : null;

    let result: PlayGameResult;
    try {
      result = await db.$transaction(async (tx) => {
        const debited = await tx.user.updateMany({
          where: { id: userId, balance: { gte: betAmount } },
          data: { balance: { decrement: betAmount } },
        });
        if (debited.count === 0) {
          throw new InsufficientBalanceError();
        }

        // handler.resolve validates params and betAmount itself and throws
        // InvalidBetParamsError on bad input — we don't re-validate here.
        const { outcome, multiplier, payout } = handler.resolve(
          generatorOpts,
          params,
          betAmount
        );

        if (payout > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: payout } },
          });
        }

        const bet = await tx.bet.create({
          data: {
            userId,
            game,
            betAmount,
            payout,
            multiplier,
            // Already computed when the nonce was reserved — do NOT
            // re-hash tuple.serverSeed here.
            serverSeedHash: tuple.serverSeedHash,
            clientSeed: tuple.clientSeed,
            nonce: tuple.nonce,
            outcome,
            params,
            idempotencyKey: storedIdempotencyKey,
          },
        });

        return {
          bet,
          outcome,
          multiplier,
          payout,
          nonce: tuple.nonce,
          serverSeedHash: tuple.serverSeedHash,
        };
      });
    } catch (err) {
      // Step 5: durable idempotency backstop. If two processes raced past
      // the Redis-level short-circuit (e.g. Redis was flushed between
      // begin() calls), the DB's unique constraint on idempotencyKey is the
      // last line of defense — fetch and return the bet that won instead
      // of surfacing a spurious 500.
      if (storedIdempotencyKey && isUniqueConstraintViolation(err)) {
        const existing = await db.bet.findUnique({ where: { idempotencyKey: storedIdempotencyKey } });
        if (!existing) throw err;
        result = {
          bet: existing,
          outcome: existing.outcome,
          multiplier: Number(existing.multiplier),
          payout: Number(existing.payout),
          nonce: existing.nonce,
          serverSeedHash: existing.serverSeedHash,
        };
      } else {
        throw err;
      }
    }

    // Step 6: cache the result for this idempotency key, awaited so a
    // crash between transaction-commit and cache-write can't silently drop
    // the record (the DB-level unique constraint backstop in step 5 still
    // covers that case for a replay).
    if (idempotencyKey && idempotency) {
      await idempotency.complete(userId, idempotencyKey, JSON.stringify(result));
    }

    // Step 7
    return result;
  }

  return { playGame };
}
