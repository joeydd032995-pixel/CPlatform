import { describe, it, expect } from 'vitest';
import { createGameService } from '../src/gameService.js';
import { createSeedService } from '../src/seedService.js';
import { InsufficientBalanceError, UnknownGameError, IdempotencyConflictError } from '@cplatform/shared';
import {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  createFakeDb,
  createFakeEnsureUser,
} from './helpers/inMemoryStores.js';

type GameCase = { game: string; params: unknown };

// Dice's 'under: 50' gives a ~50% win chance so a single deterministic roll
// from a fixed userId/seed may land either side, but since we only assert
// structural invariants (bet recorded, balances reconcile, nonce advances)
// the actual win/lose outcome doesn't matter for these happy-path checks.
const GAME_CASES: GameCase[] = [
  { game: 'mines', params: { mines: 3, picks: 2 } },
  { game: 'plinko', params: { rows: 16, risk: 'medium' } },
  { game: 'dice', params: { target: 50, direction: 'under' } },
  { game: 'roulette', params: { betType: 'red', numbers: [] } },
  { game: 'keno', params: { risk: 'classic', picks: [1, 2, 3] } },
  { game: 'chicken', params: { difficulty: 'easy', lanes: 3 } },
  { game: 'darts', params: {} },
  { game: 'hilo', params: { guesses: ['higher'] } },
  { game: 'blackjack', params: {} },
];

function buildHarness(startingBalance = 1000) {
  const seedStore = new InMemorySeedStore();
  const seedService = createSeedService(seedStore);
  const idempotency = new InMemoryIdempotencyStore();
  const db = createFakeDb();
  const ensureUser = createFakeEnsureUser(db, startingBalance);
  const gameService = createGameService({ db, seedService, idempotency });
  return { seedService, idempotency, db, ensureUser, gameService };
}

describe('gameService.playGame', () => {
  for (const { game, params } of GAME_CASES) {
    it(`happy path: ${game}`, async () => {
      const { db, ensureUser, gameService } = buildHarness(1000);
      const userId = `user-${game}`;
      await ensureUser.ensureUser(userId);

      const result = await gameService.playGame({ userId, betAmount: 10, game, params });

      expect(result.bet.game).toBe(game);
      expect(result.bet.nonce).toBe(0);
      expect(result.bet.serverSeedHash).toBe(result.serverSeedHash);

      const user = db.users.get(userId)!;
      expect(user.balance).toBeCloseTo(1000 - 10 + result.payout, 8);
      expect(db.bets).toHaveLength(1);
    });
  }

  it('insufficient balance: throws, balance unchanged, no bet recorded, nonce still burned', async () => {
    const { db, ensureUser, gameService } = buildHarness(5);
    const userId = 'user-poor';
    await ensureUser.ensureUser(userId);

    await expect(
      gameService.playGame({ userId, betAmount: 10, game: 'dice', params: { target: 50, direction: 'under' } })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    expect(db.users.get(userId)!.balance).toBe(5);
    expect(db.bets).toHaveLength(0);

    // The nonce burned on the failed attempt (nonce 0) means the next
    // successful bet gets nonce 1, not 0.
    const second = await gameService.playGame({
      userId,
      betAmount: 1,
      game: 'dice',
      params: { target: 99, direction: 'under' },
    });
    expect(second.nonce).toBe(1);
  });

  it('unknown game: throws UnknownGameError', async () => {
    const { ensureUser, gameService } = buildHarness();
    const userId = 'user-unknown-game';
    await ensureUser.ensureUser(userId);

    await expect(
      gameService.playGame({ userId, betAmount: 10, game: 'not-a-real-game', params: {} })
    ).rejects.toBeInstanceOf(UnknownGameError);
  });

  it('idempotent replay: same key twice returns cached result, no second bet row', async () => {
    const { db, ensureUser, gameService } = buildHarness();
    const userId = 'user-idem';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'replay-key-1';

    const first = await gameService.playGame({
      userId,
      betAmount: 10,
      game: 'dice',
      params: { target: 50, direction: 'under' },
      idempotencyKey,
    });
    const second = await gameService.playGame({
      userId,
      betAmount: 10,
      game: 'dice',
      params: { target: 50, direction: 'under' },
      idempotencyKey,
    });

    expect(second.bet.id).toBe(first.bet.id);
    expect(db.bets).toHaveLength(1);
  });

  it('idempotency conflict: a second call while the first is still in flight throws', async () => {
    const seedStore = new InMemorySeedStore();
    const seedService = createSeedService(seedStore);
    const idempotency = new InMemoryIdempotencyStore();
    const db = createFakeDb();
    const ensureUser = createFakeEnsureUser(db);
    const gameService = createGameService({ db, seedService, idempotency });

    const userId = 'user-conflict';
    await ensureUser.ensureUser(userId);
    const key = 'in-flight-key';

    // Simulate "still in flight" directly against the idempotency store
    // rather than racing real async timing.
    await idempotency.begin(userId, key);

    await expect(
      gameService.playGame({
        userId,
        betAmount: 10,
        game: 'dice',
        params: { target: 50, direction: 'under' },
        idempotencyKey: key,
      })
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('concurrency: 20 simultaneous bets for one user produce 20 bets with 20 distinct nonces', async () => {
    const { db, ensureUser, gameService } = buildHarness(10000);
    const userId = 'user-concurrent';
    await ensureUser.ensureUser(userId);

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        gameService.playGame({
          userId,
          betAmount: 10,
          game: 'dice',
          params: { target: 50, direction: 'under' },
        })
      )
    );

    expect(db.bets).toHaveLength(20);
    const nonces = new Set(results.map((r) => r.nonce));
    expect(nonces.size).toBe(20);

    const expectedBalance = 10000 - 20 * 10 + results.reduce((sum, r) => sum + r.payout, 0);
    expect(db.users.get(userId)!.balance).toBeCloseTo(expectedBalance, 6);
  });

  it('durable idempotency backstop: DB unique-constraint hit (no Redis layer) returns the existing bet', async () => {
    // No IdempotencyStore wired in at all, simulating the case where the
    // Redis-level short-circuit was bypassed entirely (e.g. flushed
    // between two racing calls) and the DB's unique constraint on
    // idempotencyKey is the only thing standing between a legitimate
    // replay and a duplicate bet / spurious 500.
    const seedStore = new InMemorySeedStore();
    const seedService = createSeedService(seedStore);
    const db = createFakeDb();
    const ensureUser = createFakeEnsureUser(db);
    const gameService = createGameService({ db, seedService, idempotency: null });

    const userId = 'user-db-backstop';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'db-backstop-key';

    const first = await gameService.playGame({
      userId,
      betAmount: 10,
      game: 'dice',
      params: { target: 50, direction: 'under' },
      idempotencyKey,
    });
    const second = await gameService.playGame({
      userId,
      betAmount: 10,
      game: 'dice',
      params: { target: 50, direction: 'under' },
      idempotencyKey,
    });

    expect(second.bet.id).toBe(first.bet.id);
    expect(db.bets).toHaveLength(1);
  });
});
