import {
  MinesRoundStartParamsSchema,
  deriveMinesRoundState,
  evaluateMinesReveal,
  minesMultiplier,
  BlackjackParamsSchema,
  dealInitial,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  playerInsurance,
  advanceToNextHandOrDealer,
  settleHands,
  canHit,
  canStand,
  canDouble,
  canSplit,
  canTakeInsurance,
  type MinesRoundState,
  type BlackjackRoundState,
  type Card,
} from '@cplatform/games';
import type { GeneratorOptions } from '@cplatform/core-rng';
import {
  InsufficientBalanceError,
  InvalidBetAmountError,
  IdempotencyConflictError,
  RoundNotFoundError,
  RoundVersionConflictError,
  InvalidRoundStateError,
} from '@cplatform/shared';
import type { SeedService } from './seedService.js';
import type { IdempotencyStore } from './idempotency.js';
import type { BetRecord } from './gameService.js';

// --- Persistence contracts ---------------------------------------------
//
// Same rationale as gameService.ts's GameDb/GameTx: a narrow, hand-written
// interface rather than importing `@prisma/client` types, since `prisma
// generate` needs network access this sandbox doesn't have. Structurally
// compatible with the real generated Round model (see
// packages/db/prisma/schema.prisma) -- the real client is passed in at the
// composition root with the same well-commented assertion pattern already
// used for GameDb.

export type RoundStatus = 'OPEN' | 'CASHED_OUT' | 'BUSTED' | 'SETTLED';
export type RoundGame = 'mines' | 'blackjack';

export type RoundRecord = {
  id: string;
  userId: string;
  game: string;
  status: RoundStatus;
  betAmount: unknown;
  payout: unknown | null;
  multiplier: unknown | null;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  startParams: unknown;
  serverState: unknown;
  actionLog: unknown;
  idempotencyKey?: string | null;
  version: number;
};

export interface RoundTx {
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
  round: {
    create(args: {
      data: {
        userId: string;
        game: string;
        status: RoundStatus;
        betAmount: number;
        payout: number | null;
        multiplier: number | null;
        serverSeedHash: string;
        clientSeed: string;
        nonce: number;
        startParams: unknown;
        serverState: unknown;
        actionLog: unknown;
        idempotencyKey: string | null;
      };
    }): Promise<RoundRecord>;
    findFirst(args: { where: { id: string; userId: string } }): Promise<RoundRecord | null>;
    // Optimistic-concurrency compare-and-swap: `count === 0` means the
    // supplied `version` was stale (another action already moved the round
    // on, or it doesn't belong to this user), mirroring the exact pattern
    // already used for the User.balance insufficient-funds check.
    updateMany(args: {
      where: { id: string; userId: string; version: number };
      data: {
        status?: RoundStatus;
        payout?: number | null;
        multiplier?: number | null;
        serverState?: unknown;
        actionLog?: unknown;
        version: { increment: number };
      };
    }): Promise<{ count: number }>;
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

export interface RoundDb {
  $transaction<T>(fn: (tx: RoundTx) => Promise<T>): Promise<T>;
  round: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<RoundRecord | null>;
    findUnique(args: { where: { idempotencyKey: string } }): Promise<RoundRecord | null>;
  };
}

function storageIdempotencyKey(userId: string, key: string): string {
  return `${userId}:${key}`;
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

// --- Public projections --------------------------------------------------
//
// Never expose the hidden server-side state (Mines' mine positions/full
// reveal order; Blackjack's dealer hole card before it's legitimately
// revealed) -- only what the player is meant to see at this point.

export type PublicMinesRoundView = {
  id: string;
  game: 'mines';
  status: RoundStatus;
  betAmount: number;
  mines: number;
  revealedTiles: number[];
  currentMultiplier: number;
  payout: number | null;
  version: number;
};

export type PublicBlackjackHandView = {
  cards: Card[];
  bet: number;
  status: string;
  isSplitAce?: boolean;
};

export type PublicBlackjackRoundView = {
  id: string;
  game: 'blackjack';
  status: RoundStatus;
  betAmount: number;
  hands: PublicBlackjackHandView[];
  activeHandIndex: number;
  dealerCards: Card[];
  insuranceTaken: boolean;
  insuranceBet: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canTakeInsurance: boolean;
  payout: number | null;
  version: number;
};

export type PublicRoundView = PublicMinesRoundView | PublicBlackjackRoundView;

interface MinesServerState {
  mines: number;
  round: MinesRoundState;
  revealedCount: number;
}

function toPublicMinesView(record: RoundRecord): PublicMinesRoundView {
  const state = record.serverState as MinesServerState;
  return {
    id: record.id,
    game: 'mines',
    status: record.status,
    betAmount: Number(record.betAmount),
    mines: state.mines,
    revealedTiles: state.round.revealOrder.slice(0, state.revealedCount),
    currentMultiplier:
      state.revealedCount > 0 ? minesMultiplier(state.mines, state.revealedCount) : 1,
    payout: record.payout == null ? null : Number(record.payout),
    version: record.version,
  };
}

function toPublicBlackjackView(record: RoundRecord): PublicBlackjackRoundView {
  const state = record.serverState as BlackjackRoundState;
  const dealerRevealCount = state.phase === 'settled' ? state.dealerCards.length : 1;
  return {
    id: record.id,
    game: 'blackjack',
    status: record.status,
    betAmount: Number(record.betAmount),
    hands: state.hands.map((h) => ({
      cards: h.cards,
      bet: h.bet,
      status: h.status,
      isSplitAce: h.isSplitAce,
    })),
    activeHandIndex: state.activeHandIndex,
    dealerCards: state.dealerCards.slice(0, dealerRevealCount),
    insuranceTaken: state.insuranceTaken,
    insuranceBet: state.insuranceBet,
    canHit: canHit(state),
    canStand: canStand(state),
    canDouble: canDouble(state),
    canSplit: canSplit(state),
    canTakeInsurance: canTakeInsurance(state),
    payout: record.payout == null ? null : Number(record.payout),
    version: record.version,
  };
}

function toPublicView(record: RoundRecord): PublicRoundView {
  if (record.game === 'mines') return toPublicMinesView(record);
  if (record.game === 'blackjack') return toPublicBlackjackView(record);
  throw new Error(`Unknown round game: ${record.game}`);
}

export interface RoundServiceDeps {
  db: RoundDb;
  seedService: SeedService;
  idempotency: IdempotencyStore | null;
  betLimits?: { min?: number; max?: number };
}

export function createRoundService(deps: RoundServiceDeps) {
  const { db, seedService, idempotency, betLimits } = deps;

  function checkBetLimits(betAmount: number): void {
    if (betLimits?.min != null && betAmount < betLimits.min) {
      throw new InvalidBetAmountError(
        `${betAmount} is below the minimum bet amount of ${betLimits.min}`
      );
    }
    if (betLimits?.max != null && betAmount > betLimits.max) {
      throw new InvalidBetAmountError(
        `${betAmount} exceeds the maximum bet amount of ${betLimits.max}`
      );
    }
  }

  async function loadOpenRound(userId: string, roundId: string): Promise<RoundRecord> {
    const record = await db.round.findFirst({ where: { id: roundId, userId } });
    if (!record) throw new RoundNotFoundError();
    return record;
  }

  function assertOpen(record: RoundRecord): void {
    if (record.status !== 'OPEN') {
      throw new InvalidRoundStateError(`Round is already ${record.status.toLowerCase()}`);
    }
  }

  // --- Mines -----------------------------------------------------------

  async function startMinesRound(options: {
    userId: string;
    betAmount: number;
    mines: number;
    idempotencyKey?: string;
  }): Promise<PublicMinesRoundView> {
    const { userId, betAmount, idempotencyKey } = options;

    if (idempotencyKey && idempotency) {
      const begun = await idempotency.begin(userId, idempotencyKey);
      if (begun === 'pending') throw new IdempotencyConflictError();
      if (typeof begun === 'object') {
        return JSON.parse(begun.cached) as PublicMinesRoundView;
      }
    }

    const parsed = MinesRoundStartParamsSchema.parse({ mines: options.mines });
    checkBetLimits(betAmount);

    // Same nonce-burn-on-failure tradeoff as gameService.playGame: reserved
    // before the transaction opens, never reused even if the transaction
    // aborts (e.g. insufficient balance).
    const tuple = await seedService.reserveNextNonce(userId);
    const generatorOpts: GeneratorOptions = {
      serverSeed: tuple.serverSeed,
      clientSeed: tuple.clientSeed,
      nonce: tuple.nonce,
    };
    const storedIdempotencyKey = idempotencyKey ? storageIdempotencyKey(userId, idempotencyKey) : null;

    const round = deriveMinesRoundState(generatorOpts, parsed.mines);
    const serverState: MinesServerState = { mines: parsed.mines, round, revealedCount: 0 };

    let record: RoundRecord;
    try {
      record = await db.$transaction(async (tx) => {
        const debited = await tx.user.updateMany({
          where: { id: userId, balance: { gte: betAmount } },
          data: { balance: { decrement: betAmount } },
        });
        if (debited.count === 0) throw new InsufficientBalanceError();

        return tx.round.create({
          data: {
            userId,
            game: 'mines',
            status: 'OPEN',
            betAmount,
            payout: null,
            multiplier: null,
            serverSeedHash: tuple.serverSeedHash,
            clientSeed: tuple.clientSeed,
            nonce: tuple.nonce,
            startParams: parsed,
            serverState,
            actionLog: [],
            idempotencyKey: storedIdempotencyKey,
          },
        });
      });
    } catch (err) {
      if (storedIdempotencyKey && isUniqueConstraintViolation(err)) {
        const existing = await db.round.findUnique({ where: { idempotencyKey: storedIdempotencyKey } });
        if (!existing) throw err;
        const view = toPublicMinesView(existing);
        if (idempotencyKey && idempotency) {
          await idempotency.complete(userId, idempotencyKey, JSON.stringify(view));
        }
        return view;
      }
      throw err;
    }

    const view = toPublicMinesView(record);
    if (idempotencyKey && idempotency) {
      await idempotency.complete(userId, idempotencyKey, JSON.stringify(view));
    }
    return view;
  }

  async function minesReveal(options: {
    userId: string;
    roundId: string;
    expectedVersion: number;
  }): Promise<PublicMinesRoundView> {
    const record = await loadOpenRound(options.userId, options.roundId);
    assertOpen(record);

    const state = record.serverState as MinesServerState;
    const revealedCount = state.revealedCount + 1;
    const { hitMine } = evaluateMinesReveal(state.round, state.mines, revealedCount);
    const nextServerState: MinesServerState = { ...state, revealedCount };
    const status: RoundStatus = hitMine ? 'BUSTED' : 'OPEN';

    // The version-CAS mutation and the (on bust) Bet-row write happen in
    // one transaction -- splitting these across two transactions would
    // leave a window where the round is marked busted but the audit-trail
    // Bet row hasn't been written yet (or vice versa on a crash).
    await db.$transaction(async (tx) => {
      const updated = await tx.round.updateMany({
        where: { id: options.roundId, userId: options.userId, version: options.expectedVersion },
        data: {
          status,
          payout: hitMine ? 0 : null,
          multiplier: null,
          serverState: nextServerState,
          actionLog: appendAction(record.actionLog, { type: 'reveal', hitMine, revealedCount }),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new RoundVersionConflictError();

      if (hitMine) {
        // Busted: payout is 0 (nothing to credit), but a Bet row is still
        // written so balance-history/reporting never needs to learn about
        // Round at all.
        await tx.bet.create({
          data: {
            userId: options.userId,
            game: 'mines',
            betAmount: Number(record.betAmount),
            payout: 0,
            multiplier: 0,
            serverSeedHash: record.serverSeedHash,
            clientSeed: record.clientSeed,
            nonce: record.nonce,
            outcome: {
              minePositions: state.round.minePositions,
              revealOrder: state.round.revealOrder.slice(0, revealedCount),
              hitMine: true,
            },
            params: { round: true, mines: state.mines },
            idempotencyKey: null,
          },
        });
      }
    });

    return toPublicMinesView(await refetch(options.userId, options.roundId));
  }

  async function minesCashOut(options: {
    userId: string;
    roundId: string;
    expectedVersion: number;
  }): Promise<PublicMinesRoundView> {
    const record = await loadOpenRound(options.userId, options.roundId);
    assertOpen(record);

    const state = record.serverState as MinesServerState;
    if (state.revealedCount === 0) {
      throw new InvalidRoundStateError('Cannot cash out before revealing at least one tile');
    }

    const multiplier = minesMultiplier(state.mines, state.revealedCount);
    const payout = Number(record.betAmount) * multiplier;

    await db.$transaction(async (tx) => {
      const updated = await tx.round.updateMany({
        where: { id: options.roundId, userId: options.userId, version: options.expectedVersion },
        data: {
          status: 'CASHED_OUT',
          payout,
          multiplier,
          serverState: state,
          actionLog: appendAction(record.actionLog, { type: 'cash_out', multiplier, payout }),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new RoundVersionConflictError();

      if (payout > 0) {
        await tx.user.update({
          where: { id: options.userId },
          data: { balance: { increment: payout } },
        });
      }

      await tx.bet.create({
        data: {
          userId: options.userId,
          game: 'mines',
          betAmount: Number(record.betAmount),
          payout,
          multiplier,
          serverSeedHash: record.serverSeedHash,
          clientSeed: record.clientSeed,
          nonce: record.nonce,
          outcome: {
            minePositions: state.round.minePositions,
            revealOrder: state.round.revealOrder.slice(0, state.revealedCount),
            hitMine: false,
          },
          params: { round: true, mines: state.mines },
          idempotencyKey: null,
        },
      });
    });

    return toPublicMinesView(await refetch(options.userId, options.roundId));
  }

  // --- Blackjack ---------------------------------------------------------

  async function startBlackjackRound(options: {
    userId: string;
    betAmount: number;
    idempotencyKey?: string;
  }): Promise<PublicBlackjackRoundView> {
    const { userId, betAmount, idempotencyKey } = options;

    if (idempotencyKey && idempotency) {
      const begun = await idempotency.begin(userId, idempotencyKey);
      if (begun === 'pending') throw new IdempotencyConflictError();
      if (typeof begun === 'object') {
        return JSON.parse(begun.cached) as PublicBlackjackRoundView;
      }
    }

    BlackjackParamsSchema.parse({});
    checkBetLimits(betAmount);

    const tuple = await seedService.reserveNextNonce(userId);
    const generatorOpts: GeneratorOptions = {
      serverSeed: tuple.serverSeed,
      clientSeed: tuple.clientSeed,
      nonce: tuple.nonce,
    };
    const storedIdempotencyKey = idempotencyKey ? storageIdempotencyKey(userId, idempotencyKey) : null;

    const state = dealInitial(generatorOpts, betAmount);
    const settledImmediately = state.phase === 'settled';
    const outcome = settledImmediately ? settleHands(state) : null;

    let record: RoundRecord;
    try {
      record = await db.$transaction(async (tx) => {
        const debited = await tx.user.updateMany({
          where: { id: userId, balance: { gte: betAmount } },
          data: { balance: { decrement: betAmount } },
        });
        if (debited.count === 0) throw new InsufficientBalanceError();

        if (outcome && outcome.totalPayout > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: outcome.totalPayout } },
          });
        }

        const created = await tx.round.create({
          data: {
            userId,
            game: 'blackjack',
            status: settledImmediately ? 'SETTLED' : 'OPEN',
            betAmount,
            payout: outcome ? outcome.totalPayout : null,
            multiplier: outcome ? outcome.totalPayout / betAmount : null,
            serverSeedHash: tuple.serverSeedHash,
            clientSeed: tuple.clientSeed,
            nonce: tuple.nonce,
            startParams: {},
            serverState: state,
            actionLog: [{ type: 'deal', at: new Date().toISOString() }],
            idempotencyKey: storedIdempotencyKey,
          },
        });

        if (outcome) {
          await tx.bet.create({
            data: {
              userId,
              game: 'blackjack',
              betAmount,
              payout: outcome.totalPayout,
              multiplier: outcome.totalPayout / betAmount,
              serverSeedHash: tuple.serverSeedHash,
              clientSeed: tuple.clientSeed,
              nonce: tuple.nonce,
              outcome: outcome.outcome,
              params: { round: true },
              idempotencyKey: null,
            },
          });
        }

        return created;
      });
    } catch (err) {
      if (storedIdempotencyKey && isUniqueConstraintViolation(err)) {
        const existing = await db.round.findUnique({ where: { idempotencyKey: storedIdempotencyKey } });
        if (!existing) throw err;
        const view = toPublicBlackjackView(existing);
        if (idempotencyKey && idempotency) {
          await idempotency.complete(userId, idempotencyKey, JSON.stringify(view));
        }
        return view;
      }
      throw err;
    }

    const view = toPublicBlackjackView(record);
    if (idempotencyKey && idempotency) {
      await idempotency.complete(userId, idempotencyKey, JSON.stringify(view));
    }
    return view;
  }

  async function blackjackAction(options: {
    userId: string;
    roundId: string;
    expectedVersion: number;
    action: 'hit' | 'stand' | 'double' | 'split' | 'insurance';
  }): Promise<PublicBlackjackRoundView> {
    const record = await loadOpenRound(options.userId, options.roundId);
    assertOpen(record);

    const state = record.serverState as BlackjackRoundState;
    const generatorOpts: GeneratorOptions = {
      serverSeed: await resolveServerSeedForRound(options.userId, record),
      clientSeed: record.clientSeed,
      nonce: record.nonce,
    };

    let nextState: BlackjackRoundState;
    let additionalDebit = 0;

    switch (options.action) {
      case 'hit':
        nextState = playerHit(generatorOpts, state);
        break;
      case 'stand':
        nextState = playerStand(generatorOpts, state);
        break;
      case 'double': {
        const r = playerDouble(generatorOpts, state);
        nextState = r.state;
        additionalDebit = r.additionalDebit;
        break;
      }
      case 'split': {
        const r = playerSplit(generatorOpts, state);
        nextState = r.state;
        additionalDebit = r.additionalDebit;
        break;
      }
      case 'insurance': {
        const r = playerInsurance(state);
        nextState = advanceToNextHandOrDealer(generatorOpts, r.state);
        additionalDebit = r.additionalDebit;
        break;
      }
      default:
        throw new InvalidRoundStateError(`Unknown blackjack action: ${String(options.action)}`);
    }

    const settledNow = nextState.phase === 'settled';
    const outcome = settledNow ? settleHands(nextState) : null;

    await db.$transaction(async (tx) => {
      if (additionalDebit > 0) {
        const debited = await tx.user.updateMany({
          where: { id: options.userId, balance: { gte: additionalDebit } },
          data: { balance: { decrement: additionalDebit } },
        });
        if (debited.count === 0) throw new InsufficientBalanceError();
      }
      if (outcome && outcome.totalPayout > 0) {
        await tx.user.update({
          where: { id: options.userId },
          data: { balance: { increment: outcome.totalPayout } },
        });
      }

      const totalBet = nextState.hands.reduce((sum, h) => sum + h.bet, 0) + nextState.insuranceBet;
      const updated = await tx.round.updateMany({
        where: { id: options.roundId, userId: options.userId, version: options.expectedVersion },
        data: {
          status: settledNow ? 'SETTLED' : 'OPEN',
          payout: outcome ? outcome.totalPayout : null,
          multiplier: outcome ? outcome.totalPayout / totalBet : null,
          serverState: nextState,
          actionLog: appendAction(record.actionLog, { type: options.action, at: new Date().toISOString() }),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new RoundVersionConflictError();

      if (outcome) {
        await tx.bet.create({
          data: {
            userId: options.userId,
            game: 'blackjack',
            betAmount: totalBet,
            payout: outcome.totalPayout,
            multiplier: outcome.totalPayout / totalBet,
            serverSeedHash: record.serverSeedHash,
            clientSeed: record.clientSeed,
            nonce: record.nonce,
            outcome: outcome.outcome,
            params: { round: true },
            idempotencyKey: null,
          },
        });
      }
    });

    return toPublicBlackjackView(await refetch(options.userId, options.roundId));
  }

  async function getRound(options: { userId: string; roundId: string }): Promise<PublicRoundView> {
    const record = await loadOpenRound(options.userId, options.roundId);
    return toPublicView(record);
  }

  // --- Shared helpers ------------------------------------------------------

  async function refetch(userId: string, roundId: string): Promise<RoundRecord> {
    const record = await db.round.findFirst({ where: { id: roundId, userId } });
    if (!record) throw new RoundNotFoundError();
    return record;
  }

  function appendAction(actionLog: unknown, entry: Record<string, unknown>): unknown {
    const log = Array.isArray(actionLog) ? actionLog : [];
    return [...log, { ...entry, at: entry.at ?? new Date().toISOString() }];
  }

  // Blackjack actions need the raw server seed (not just its hash) to
  // re-derive the float stream -- rather than storing the raw seed a
  // second time on the Round row, this reads it from seedService's
  // still-active seed state via peekActiveSeed (no nonce reserved).
  async function resolveServerSeedForRound(userId: string, record: RoundRecord): Promise<string> {
    const active = await seedService.peekActiveSeed(userId);
    if (active.serverSeedHash !== record.serverSeedHash) {
      throw new InvalidRoundStateError(
        'The server seed backing this round has been rotated and can no longer be used for further actions'
      );
    }
    return active.serverSeed;
  }

  return {
    startMinesRound,
    minesReveal,
    minesCashOut,
    startBlackjackRound,
    blackjackAction,
    getRound,
  };
}
