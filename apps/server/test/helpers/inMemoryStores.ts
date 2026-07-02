import type { SeedFields, SeedStore, SeedTuple } from '../../src/seedStore.js';
import type { IdempotencyStore, BeginResult } from '../../src/idempotency.js';
import type { GameDb, GameTx, BetRecord } from '../../src/gameService.js';
import type { EnsureUser } from '../../src/middleware/auth.js';

// Every method below mutates a plain in-process Map synchronously before
// its first `await` (there isn't one) — since JS is single-threaded and
// these functions never yield mid-mutation, two "concurrent" calls (e.g.
// from Promise.all) can never interleave inside one of these methods. That
// honestly mirrors the atomicity a Redis Lua script gives the real
// RedisSeedStore/RedisIdempotencyStore (which also run to completion before
// yielding to any other client), so this fake is a faithful stand-in for
// concurrency tests, not just a convenience shim.

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export class InMemorySeedStore implements SeedStore {
  private fields = new Map<string, SeedFields>();
  private history = new Map<string, string[]>();

  async initIfAbsent(
    userId: string,
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string
  ): Promise<boolean> {
    if (this.fields.has(userId)) return false;
    this.fields.set(userId, {
      activeServerSeed: serverSeed,
      activeServerSeedHash: serverSeedHash,
      activeClientSeed: clientSeed,
      currentNonce: 0,
    });
    this.history.set(userId, []);
    return true;
  }

  async getFields(userId: string): Promise<SeedFields | null> {
    const f = this.fields.get(userId);
    return f ? { ...f } : null;
  }

  async reserveNonce(userId: string): Promise<SeedTuple> {
    const f = this.fields.get(userId);
    if (!f) throw new Error(`Seed state for user ${userId} was not initialized before this call`);
    const nonce = f.currentNonce;
    f.currentNonce += 1;
    return {
      nonce,
      serverSeed: f.activeServerSeed,
      serverSeedHash: f.activeServerSeedHash,
      clientSeed: f.activeClientSeed,
    };
  }

  async updateClientSeed(userId: string, clientSeed: string): Promise<void> {
    const f = this.fields.get(userId);
    if (!f) throw new Error(`Seed state for user ${userId} was not initialized before this call`);
    f.activeClientSeed = clientSeed;
    f.currentNonce = 0;
  }

  async rotateSeed(
    userId: string,
    newServerSeed: string,
    newServerSeedHash: string,
    rotatedAtIso: string
  ): Promise<{ serverSeed: string; serverSeedHash: string; clientSeed: string; finalNonce: number }> {
    const f = this.fields.get(userId);
    if (!f) throw new Error(`Seed state for user ${userId} was not initialized before this call`);
    const old = {
      serverSeed: f.activeServerSeed,
      serverSeedHash: f.activeServerSeedHash,
      clientSeed: f.activeClientSeed,
      finalNonce: f.currentNonce,
    };
    const historyList = this.history.get(userId) ?? [];
    historyList.push(JSON.stringify({ ...old, rotatedAt: rotatedAtIso }));
    this.history.set(userId, historyList);

    f.activeServerSeed = newServerSeed;
    f.activeServerSeedHash = newServerSeedHash;
    f.currentNonce = 0;
    return old;
  }

  async getHistory(userId: string): Promise<string[]> {
    return [...(this.history.get(userId) ?? [])];
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private entries = new Map<string, string>();
  private static readonly PENDING = '__pending__';

  async begin(userId: string, key: string): Promise<BeginResult> {
    const k = `${userId}:${key}`;
    if (!this.entries.has(k)) {
      this.entries.set(k, InMemoryIdempotencyStore.PENDING);
      return 'started';
    }
    const existing = this.entries.get(k)!;
    if (existing === InMemoryIdempotencyStore.PENDING) return 'pending';
    return { cached: existing };
  }

  async complete(userId: string, key: string, resultJson: string): Promise<void> {
    this.entries.set(`${userId}:${key}`, resultJson);
  }
}

type FakeUser = { id: string; balance: number };

export function createFakeDb(): GameDb & { users: Map<string, FakeUser>; bets: BetRecord[] } {
  const users = new Map<string, FakeUser>();
  const bets: BetRecord[] = [];

  // Simple clone-and-swap "transaction": operations run against clones of
  // the users map / bets array; on success the clones are swapped in, on
  // throw they're discarded, so a failed transaction leaves no trace.
  //
  // Real Postgres (via Prisma) serializes concurrent transactions that
  // touch the same rows through row-level locking. A naive clone-on-entry
  // fake wouldn't reproduce that: two `$transaction` calls started via
  // `Promise.all` would each snapshot `users` at nearly the same time and
  // the second commit would clobber the first's write (a classic lost
  // update). To honestly stand in for a real serializable transaction
  // under the concurrency tests, every call queues behind a single tail
  // promise below so transaction BODIES never actually run concurrently
  // with each other, even though callers can kick them off concurrently.
  let tail: Promise<unknown> = Promise.resolve();

  async function runTransaction<T>(fn: (tx: GameTx) => Promise<T>): Promise<T> {
    const stagedUsers = new Map(users);
    const stagedBets = [...bets];

      const tx: GameTx = {
        user: {
          async updateMany({ where, data }) {
            const u = stagedUsers.get(where.id);
            if (!u || u.balance < where.balance.gte) {
              return { count: 0 };
            }
            stagedUsers.set(where.id, { ...u, balance: u.balance - data.balance.decrement });
            return { count: 1 };
          },
          async update({ where, data }) {
            const u = stagedUsers.get(where.id);
            if (!u) throw new Error(`user ${where.id} not found`);
            stagedUsers.set(where.id, { ...u, balance: u.balance + data.balance.increment });
            return u;
          },
        },
        bet: {
          async create({ data }) {
            if (data.idempotencyKey) {
              const dup = stagedBets.find((b) => b.idempotencyKey === data.idempotencyKey);
              if (dup) {
                const err = new Error('Unique constraint failed on idempotencyKey') as Error & {
                  code: string;
                };
                err.code = 'P2002';
                throw err;
              }
            }
            const bet: BetRecord = { id: nextId('bet'), ...data };
            stagedBets.push(bet);
            return bet;
          },
        },
      };

      const result = await fn(tx);

      // Commit: swap staged state into the real maps/arrays.
      users.clear();
      for (const [k, v] of stagedUsers) users.set(k, v);
      bets.length = 0;
      bets.push(...stagedBets);

      return result;
  }

  const db: GameDb & { users: Map<string, FakeUser>; bets: BetRecord[] } = {
    users,
    bets,
    bet: {
      async findUnique({ where }) {
        return bets.find((b) => b.idempotencyKey === where.idempotencyKey) ?? null;
      },
    },
    $transaction<T>(fn: (tx: GameTx) => Promise<T>): Promise<T> {
      const result = tail.then(() => runTransaction(fn));
      // Keep the queue moving regardless of whether this transaction
      // succeeded or failed; the caller still sees `result`'s real
      // rejection, this just prevents one failed transaction from wedging
      // every subsequent one.
      tail = result.catch(() => undefined);
      return result;
    },
  };

  return db;
}

export function createFakeEnsureUser(db: { users: Map<string, FakeUser> }, startingBalance = 1000): EnsureUser {
  return {
    async ensureUser(userId: string): Promise<void> {
      if (!db.users.has(userId)) {
        db.users.set(userId, { id: userId, balance: startingBalance });
      }
    },
  };
}
