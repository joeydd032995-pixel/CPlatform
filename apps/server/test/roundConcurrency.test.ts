import { describe, it, expect } from 'vitest';
import { createRoundService } from '../src/roundService.js';
import { createSeedService } from '../src/seedService.js';
import { RoundVersionConflictError, IdempotencyConflictError } from '@cplatform/shared';
import {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  createFakeDb,
  createFakeRoundDb,
  createFakeEnsureUser,
} from './helpers/inMemoryStores.js';

// Genuine concurrent (Promise.all-fired) requests against the round-action
// endpoints, as distinct from the sequential "retry with a stale version"
// tests in roundService.test.ts -- these confirm the version-CAS guard
// actually serializes real races, not just replays.

function buildHarness(startingBalance = 1000) {
  const seedStore = new InMemorySeedStore();
  const seedService = createSeedService(seedStore);
  const idempotency = new InMemoryIdempotencyStore();
  const db = createFakeDb();
  const roundDb = createFakeRoundDb(db);
  const ensureUser = createFakeEnsureUser(db, startingBalance);
  const roundService = createRoundService({ db: roundDb, seedService, idempotency });
  return { seedService, idempotency, db, roundDb, ensureUser, roundService };
}

describe('Round action concurrency: Mines', () => {
  it('20 concurrent duplicate reveal requests against the same round: exactly one succeeds, the rest conflict', async () => {
    const { ensureUser, roundService, roundDb } = buildHarness(1000);
    const userId = 'user-concurrent-mines-reveal';
    await ensureUser.ensureUser(userId);

    const started = await roundService.startMinesRound({ userId, betAmount: 10, mines: 1 });

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        roundService.minesReveal({ userId, roundId: started.id, expectedVersion: started.version })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(RoundVersionConflictError);
    }

    // The round only actually advanced once -- version incremented by
    // exactly 1, not 20.
    const record = roundDb.rounds.get(started.id)!;
    expect(record.version).toBe(started.version + 1);
  });

  it('a burst of concurrent reveals, one at a time per round, never double-advances the round', async () => {
    const { ensureUser, roundService, roundDb } = buildHarness(1000);
    const userId = 'user-concurrent-mines-sequence';
    await ensureUser.ensureUser(userId);

    let round = await roundService.startMinesRound({ userId, betAmount: 10, mines: 1 });
    let totalSuccesses = 0;

    // Each wave fires 5 concurrent reveal attempts against the round's
    // CURRENT version; exactly one should win per wave (advancing the
    // round by exactly one reveal), the rest must conflict.
    for (let wave = 0; wave < 5 && round.status === 'OPEN'; wave++) {
      const version = round.version;
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          roundService.minesReveal({ userId, roundId: round.id, expectedVersion: version })
        )
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
        Awaited<ReturnType<typeof roundService.minesReveal>>
      >[];
      expect(fulfilled).toHaveLength(1);
      totalSuccesses += 1;
      round = fulfilled[0]!.value;
    }

    const finalRecord = roundDb.rounds.get(round.id)!;
    // The round's version only ever incremented once per wave that
    // actually ran (never more), confirming no lost/duplicate mutations.
    expect(finalRecord.version).toBe(totalSuccesses);
  });

  it('20 concurrent duplicate start-round requests with the same idempotency key: exactly one debit', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-concurrent-mines-start';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'concurrent-mines-start-key';

    // With a genuinely concurrent Promise.all-fired burst, the in-memory
    // idempotency store's `begin` is checked before any of the 20 calls have
    // resolved, so only the first request that reaches `begin` actually
    // proceeds -- the rest fail fast with IdempotencyConflictError (the
    // client is expected to retry/refetch), rather than all transparently
    // returning the same cached round as in the sequential-replay tests in
    // roundService.test.ts. Either way, exactly one debit must occur.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        roundService.startMinesRound({ userId, betAmount: 100, mines: 3, idempotencyKey })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
      Awaited<ReturnType<typeof roundService.startMinesRound>>
    >[];
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(20);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(IdempotencyConflictError);
    }

    const roundIds = new Set(fulfilled.map((r) => r.value.id));
    expect(roundIds.size).toBe(1);
    expect(db.users.get(userId)!.balance).toBe(900);
  });
});

describe('Round action concurrency: Blackjack', () => {
  it('20 concurrent duplicate action requests against the same round: exactly one succeeds, the rest conflict', async () => {
    const { ensureUser, roundService } = buildHarness(1000);

    for (let i = 0; i < 200; i++) {
      const userId = `user-concurrent-bj-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'OPEN' || !round.canStand) continue;

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          roundService.blackjackAction({
            userId,
            roundId: round.id,
            expectedVersion: round.version,
            action: 'stand',
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(RoundVersionConflictError);
      }
      return;
    }
    throw new Error('no stand-eligible opening hand found within 200 attempts');
  });

  it('20 concurrent duplicate start-round requests with the same idempotency key: exactly one debit', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-concurrent-bj-start';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'concurrent-bj-start-key';

    // Same genuine-concurrency caveat as the Mines start test above: only
    // the first request to reach `begin` proceeds, the rest fail fast.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        roundService.startBlackjackRound({ userId, betAmount: 100, idempotencyKey })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
      Awaited<ReturnType<typeof roundService.startBlackjackRound>>
    >[];
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(20);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(IdempotencyConflictError);
    }

    const roundIds = new Set(fulfilled.map((r) => r.value.id));
    expect(roundIds.size).toBe(1);
    // Exactly one debit (100) happened regardless of a possible immediate
    // natural settlement crediting a payout on top.
    const first = fulfilled[0]!.value;
    const expectedBalance = 900 + (first.status === 'SETTLED' ? first.payout! : 0);
    expect(db.users.get(userId)!.balance).toBeCloseTo(expectedBalance, 6);
  });
});
