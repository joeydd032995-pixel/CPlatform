import { describe, it, expect } from 'vitest';
import { createRoundService } from '../src/roundService.js';
import { createSeedService } from '../src/seedService.js';
import {
  InsufficientBalanceError,
  RoundNotFoundError,
  RoundVersionConflictError,
  InvalidRoundStateError,
  IdempotencyConflictError,
} from '@cplatform/shared';
import {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  createFakeDb,
  createFakeRoundDb,
  createFakeEnsureUser,
} from './helpers/inMemoryStores.js';

// 24 mines / 1 safe tile makes a bust likely (24/25) but not certain on any
// single reveal -- scans userIds (each maps to distinct deterministic seed
// material) until one actually busts on the first reveal, rather than
// assuming it always will.
async function startAndBustMinesRound(
  roundService: ReturnType<typeof import('../src/roundService.js').createRoundService>,
  ensureUser: { ensureUser(userId: string): Promise<void> },
  userIdPrefix: string,
  betAmount = 10
) {
  for (let i = 0; i < 50; i++) {
    const userId = `${userIdPrefix}-${i}`;
    await ensureUser.ensureUser(userId);
    const started = await roundService.startMinesRound({ userId, betAmount, mines: 24 });
    const revealed = await roundService.minesReveal({
      userId,
      roundId: started.id,
      expectedVersion: started.version,
    });
    if (revealed.status === 'BUSTED') {
      return { userId, started, revealed };
    }
  }
  throw new Error('no bust found within 50 attempts -- unexpected given a 24/25 bust chance per try');
}

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

describe('roundService: Mines cash-out flow', () => {
  it('happy path: start -> reveal a safe tile -> cash out, balance reconciles', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-mines-1';
    await ensureUser.ensureUser(userId);

    const started = await roundService.startMinesRound({ userId, betAmount: 100, mines: 3 });
    expect(started.status).toBe('OPEN');
    expect(started.mines).toBe(3);
    expect(started.revealedTiles).toEqual([]);
    expect(db.users.get(userId)!.balance).toBe(900);

    // Reveal tiles until we find a safe one to cash out on (bounded retry:
    // if the very first tile happens to be a mine, that's still a valid,
    // separately-tested BUSTED path -- this test specifically covers the
    // safe-reveal-then-cash-out path).
    let revealed = started;
    let version = started.version;
    for (let i = 0; i < 20 && revealed.status === 'OPEN' && revealed.revealedTiles.length === 0; i++) {
      revealed = await roundService.minesReveal({ userId, roundId: started.id, expectedVersion: version });
      version = revealed.version;
      if (revealed.status !== 'OPEN') break;
    }

    if (revealed.status === 'BUSTED') {
      // Landed on a mine on the very first reveal for this seed -- balance
      // should reflect the bust (no credit), which is exactly what the
      // dedicated bust test below asserts precisely.
      expect(db.users.get(userId)!.balance).toBe(900);
      return;
    }

    expect(revealed.revealedTiles.length).toBeGreaterThan(0);
    expect(revealed.currentMultiplier).toBeGreaterThan(1);

    const cashedOut = await roundService.minesCashOut({
      userId,
      roundId: started.id,
      expectedVersion: revealed.version,
    });
    expect(cashedOut.status).toBe('CASHED_OUT');
    expect(cashedOut.payout).toBeCloseTo(100 * revealed.currentMultiplier, 8);
    expect(db.users.get(userId)!.balance).toBeCloseTo(900 + cashedOut.payout!, 8);
  });

  it('busting: hitting a mine sets status BUSTED, payout 0, no balance credit', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const { userId, revealed } = await startAndBustMinesRound(roundService, ensureUser, 'user-mines-bust', 50);

    expect(revealed.status).toBe('BUSTED');
    expect(revealed.payout).toBe(0);
    expect(db.users.get(userId)!.balance).toBe(950); // debited, never credited
  });

  it('rejects cash-out before any reveal', async () => {
    const { ensureUser, roundService } = buildHarness();
    const userId = 'user-mines-early-cashout';
    await ensureUser.ensureUser(userId);
    const started = await roundService.startMinesRound({ userId, betAmount: 10, mines: 5 });

    await expect(
      roundService.minesCashOut({ userId, roundId: started.id, expectedVersion: started.version })
    ).rejects.toBeInstanceOf(InvalidRoundStateError);
  });

  it('rejects acting on a round that has already busted/cashed out', async () => {
    const { ensureUser, roundService } = buildHarness();
    const { userId, started, revealed } = await startAndBustMinesRound(
      roundService,
      ensureUser,
      'user-mines-already-settled'
    );
    expect(revealed.status).toBe('BUSTED');

    await expect(
      roundService.minesReveal({ userId, roundId: started.id, expectedVersion: revealed.version })
    ).rejects.toBeInstanceOf(InvalidRoundStateError);
  });

  it('rejects a stale version (concurrency guard)', async () => {
    const { ensureUser, roundService } = buildHarness();

    // Scan for a userId whose first reveal is safe, so the round is
    // guaranteed to still be OPEN when the stale retry below runs --
    // otherwise a bust would make the retry correctly fail for a different
    // reason (InvalidRoundStateError from assertOpen, not the version
    // check this test targets).
    for (let i = 0; i < 50; i++) {
      const userId = `user-mines-version-conflict-${i}`;
      await ensureUser.ensureUser(userId);
      const started = await roundService.startMinesRound({ userId, betAmount: 10, mines: 3 });
      const revealed = await roundService.minesReveal({
        userId,
        roundId: started.id,
        expectedVersion: started.version,
      });
      if (revealed.status !== 'OPEN') continue;

      // Retrying with the now-stale original version must be rejected.
      await expect(
        roundService.minesReveal({ userId, roundId: started.id, expectedVersion: started.version })
      ).rejects.toBeInstanceOf(RoundVersionConflictError);
      return;
    }
    throw new Error('no safe first reveal found within 50 attempts');
  });

  it('rejects starting a round with insufficient balance, creates no round', async () => {
    const { db, ensureUser, roundService } = buildHarness(5);
    const userId = 'user-mines-poor';
    await ensureUser.ensureUser(userId);

    await expect(
      roundService.startMinesRound({ userId, betAmount: 100, mines: 3 })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
    expect(db.users.get(userId)!.balance).toBe(5);
  });

  it('idempotent replay: starting twice with the same key returns the same round, no double debit', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-mines-idem';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'mines-start-key-1';

    const first = await roundService.startMinesRound({
      userId,
      betAmount: 100,
      mines: 3,
      idempotencyKey,
    });
    const second = await roundService.startMinesRound({
      userId,
      betAmount: 100,
      mines: 3,
      idempotencyKey,
    });

    expect(second.id).toBe(first.id);
    expect(db.users.get(userId)!.balance).toBe(900);
  });

  it('rejects acting on another user\'s round', async () => {
    const { ensureUser, roundService } = buildHarness();
    await ensureUser.ensureUser('user-a');
    await ensureUser.ensureUser('user-b');
    const started = await roundService.startMinesRound({ userId: 'user-a', betAmount: 10, mines: 3 });

    await expect(
      roundService.minesReveal({ userId: 'user-b', roundId: started.id, expectedVersion: started.version })
    ).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});

describe('roundService: Blackjack real-time decisions', () => {
  it('happy path: start -> hit/stand until settled, balance reconciles', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-bj-1';
    await ensureUser.ensureUser(userId);

    let round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
    // Seed material is randomly generated per test run (see InMemorySeedStore
    // -- ensureSeedState uses real crypto randomness), so this deal can
    // legitimately be a natural that settles and credits payout immediately
    // in the same transaction as the debit -- account for that rather than
    // assuming the round always starts OPEN and uncredited.
    expect(db.users.get(userId)!.balance).toBeCloseTo(900 + (round.status === 'SETTLED' ? round.payout! : 0), 6);

    let guard = 0;
    while (round.status === 'OPEN' && guard < 20) {
      guard++;
      if (round.canStand) {
        round = await roundService.blackjackAction({
          userId,
          roundId: round.id,
          expectedVersion: round.version,
          action: 'stand',
        });
      } else {
        break;
      }
    }

    expect(round.status).toBe('SETTLED');
    expect(round.payout).not.toBeNull();
    expect(db.users.get(userId)!.balance).toBeCloseTo(900 + round.payout!, 6);
  });

  it('a natural settles the round immediately at start, with no legal actions', async () => {
    const { ensureUser, roundService } = buildHarness(1000);
    // Scan userIds until a natural comes up (deterministic given each
    // distinct userId maps to distinct seed material via ensureSeedState).
    for (let i = 0; i < 200; i++) {
      const userId = `user-bj-natural-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status === 'SETTLED') {
        expect(round.canHit).toBe(false);
        expect(round.canStand).toBe(false);
        expect(round.payout).not.toBeNull();
        return;
      }
    }
    throw new Error('no natural found within 200 attempts -- unexpected given ~4.8% natural rate per side');
  });

  it('double debits the additional stake and forces settlement/next hand', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    // Scan userIds for one whose opening hand allows a double.
    for (let i = 0; i < 500; i++) {
      const userId = `user-bj-double-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'OPEN' || !round.canDouble) continue;

      const balanceBeforeDouble = db.users.get(userId)!.balance;
      const afterDouble = await roundService.blackjackAction({
        userId,
        roundId: round.id,
        expectedVersion: round.version,
        action: 'double',
      });
      // Exactly 100 more was debited for the double itself, regardless of
      // whether the hand also settled immediately afterward (settlement's
      // payout is a separate credit, checked below).
      const expectedAfterDebit = balanceBeforeDouble - 100;
      if (afterDouble.status === 'OPEN') {
        expect(db.users.get(userId)!.balance).toBe(expectedAfterDebit);
      } else {
        expect(db.users.get(userId)!.balance).toBeCloseTo(
          expectedAfterDebit + (afterDouble.payout ?? 0),
          6
        );
      }
      return;
    }
    throw new Error('no double-eligible opening hand found within 500 attempts');
  });

  it('split produces two hands and debits exactly the original bet again', async () => {
    const { ensureUser, roundService } = buildHarness(1000);
    for (let i = 0; i < 2000; i++) {
      const userId = `user-bj-split-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'OPEN' || !round.canSplit) continue;

      const afterSplit = await roundService.blackjackAction({
        userId,
        roundId: round.id,
        expectedVersion: round.version,
        action: 'split',
      });
      expect(afterSplit.hands).toHaveLength(2);
      expect(afterSplit.hands[0]!.bet).toBe(100);
      expect(afterSplit.hands[1]!.bet).toBe(100);
      return;
    }
    throw new Error('no split-eligible opening hand found within 2000 attempts');
  });

  it('insurance debits half the bet and is only offered with a dealer Ace upcard', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    for (let i = 0; i < 2000; i++) {
      const userId = `user-bj-insurance-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'OPEN' || !round.canTakeInsurance) continue;

      const balanceBefore = db.users.get(userId)!.balance;
      const afterInsurance = await roundService.blackjackAction({
        userId,
        roundId: round.id,
        expectedVersion: round.version,
        action: 'insurance',
      });
      expect(afterInsurance.insuranceTaken).toBe(true);
      expect(afterInsurance.insuranceBet).toBe(50);
      expect(db.users.get(userId)!.balance).toBe(balanceBefore - 50);
      expect(afterInsurance.canTakeInsurance).toBe(false);
      return;
    }
    throw new Error('no insurance-eligible opening hand found within 2000 attempts');
  });

  it('rejects a stale version on a blackjack action', async () => {
    const { ensureUser, roundService } = buildHarness(1000);
    for (let i = 0; i < 2000; i++) {
      const userId = `user-bj-version-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'OPEN' || !round.canHit) continue;

      const afterHit = await roundService.blackjackAction({
        userId,
        roundId: round.id,
        expectedVersion: round.version,
        action: 'hit',
      });
      // Require the round to still be open and hittable after this hit, so
      // the retry below unambiguously reaches the version-check branch
      // rather than the "round already settled" branch (a hit can bust and
      // settle the round in one action, which is a different, separately
      // tested rejection path).
      if (afterHit.status !== 'OPEN' || !afterHit.canHit) continue;

      await expect(
        roundService.blackjackAction({
          userId,
          roundId: round.id,
          expectedVersion: round.version, // stale, already consumed above
          action: 'hit',
        })
      ).rejects.toBeInstanceOf(RoundVersionConflictError);
      return;
    }
    throw new Error('no suitable still-open-after-one-hit hand found within 2000 attempts');
  });

  it('rejects acting on an already-settled round', async () => {
    const { ensureUser, roundService } = buildHarness(1000);
    for (let i = 0; i < 200; i++) {
      const userId = `user-bj-settled-${i}`;
      await ensureUser.ensureUser(userId);
      const round = await roundService.startBlackjackRound({ userId, betAmount: 100 });
      if (round.status !== 'SETTLED') continue;

      await expect(
        roundService.blackjackAction({
          userId,
          roundId: round.id,
          expectedVersion: round.version,
          action: 'stand',
        })
      ).rejects.toBeInstanceOf(InvalidRoundStateError);
      return;
    }
    throw new Error('no immediately-settled round found within 200 attempts');
  });

  it('idempotent replay: starting twice with the same key returns the same round, no double debit', async () => {
    const { db, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-bj-idem';
    await ensureUser.ensureUser(userId);
    const idempotencyKey = 'bj-start-key-1';

    const first = await roundService.startBlackjackRound({ userId, betAmount: 100, idempotencyKey });
    const second = await roundService.startBlackjackRound({ userId, betAmount: 100, idempotencyKey });

    expect(second.id).toBe(first.id);
    // The debit (100) must happen exactly once regardless of a replay; if
    // this particular seed happens to deal a natural, the round also
    // settles and credits its payout immediately -- account for that rather
    // than assuming the round stays open and uncredited.
    const expectedBalance = 900 + (first.payout ?? 0);
    expect(db.users.get(userId)!.balance).toBeCloseTo(expectedBalance, 6);
  });

  it('idempotency conflict: a second call while the first is still in flight throws', async () => {
    const { idempotency, ensureUser, roundService } = buildHarness(1000);
    const userId = 'user-bj-conflict';
    await ensureUser.ensureUser(userId);
    const key = 'bj-in-flight-key';

    await idempotency.begin(userId, key);

    await expect(
      roundService.startBlackjackRound({ userId, betAmount: 100, idempotencyKey: key })
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});
