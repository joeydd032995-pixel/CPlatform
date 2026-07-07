import type { SeedFields, SeedStore, SeedTuple } from './seedStore.js';
import type { IdempotencyStore, BeginResult } from './idempotency.js';
import type { GameDb, GameTx, BetRecord } from './gameService.js';
import type { RoundDb, RoundTx, RoundRecord } from './roundService.js';
import type { EnsureUser } from './middleware/auth.js';
import type { UserDb } from './routes/me.js';
import type { RateLimitCounter } from './middleware/rateLimit.js';

// In-memory implementations of every persistence interface the app depends
// on. They serve two callers:
//
//   1. The test suite (test/helpers/inMemoryStores.ts re-exports these), as
//      faithful stand-ins for Postgres/Redis in unit and route tests.
//   2. DEMO_MODE (createApp.ts): a deployment that sets DEMO_MODE=true runs
//      the whole platform against these stores with NO database or Redis at
//      all -- for trying the games out, not for anything real.
//
// DEMO_MODE caveats (also documented in DEPLOYMENT.md): all state (balances,
// bets, seed history, open rounds) lives in this process's memory only. On a
// serverless platform like Vercel that means it resets on every cold start
// and is NOT shared between concurrently-warm function instances -- your
// balance can appear to jump around if consecutive requests land on
// different instances. Fine for kicking the tires on the games; never use it
// for real money.
//
// Every method below mutates a plain in-process Map synchronously before
// its first `await` (there isn't one) — since JS is single-threaded and
// these functions never yield mid-mutation, two "concurrent" calls (e.g.
// from Promise.all) can never interleave inside one of these methods. That
// honestly mirrors the atomicity a Redis Lua script gives the real
// RedisSeedStore/RedisIdempotencyStore (which also run to completion before
// yielding to any other client), so these are faithful stand-ins for
// concurrency tests, not just convenience shims.

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

// Implements the same INCR-with-EXPIRE semantics as the Lua script in
// middleware/rateLimit.ts, keyed the same way (the caller's key already
// embeds the window number, so expiry here is purely memory cleanup).
export class InMemoryRateLimitCounter implements RateLimitCounter {
  private counts = new Map<string, { count: number; expiresAt: number }>();

  async eval(_script: string, _numKeys: number, ...args: Array<string | number>): Promise<unknown> {
    const key = String(args[0]);
    const windowSeconds = Number(args[1]);
    const now = Date.now();

    const existing = this.counts.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.counts.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      // Lazy prune so long-lived processes with many users/windows don't
      // accumulate dead window keys unboundedly.
      if (this.counts.size > 10_000) {
        for (const [k, v] of this.counts) {
          if (v.expiresAt <= now) this.counts.delete(k);
        }
      }
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

type InMemoryUser = { id: string; balance: number };

export function createInMemoryDb(): GameDb & { users: Map<string, InMemoryUser>; bets: BetRecord[] } {
  const users = new Map<string, InMemoryUser>();
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

  const db: GameDb & { users: Map<string, InMemoryUser>; bets: BetRecord[] } = {
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

// Shares the same `users`/`bets` state as an existing createInMemoryDb()
// instance (so gameService and roundService can observe each other's balance
// mutations) and adds its own `rounds` Map with the same version-based
// compare-and-swap semantics roundService.ts relies on in production
// against a real `updateMany({ where: { version } })` call.
export function createInMemoryRoundDb(
  db: { users: Map<string, InMemoryUser>; bets: BetRecord[] }
): RoundDb & { rounds: Map<string, RoundRecord> } {
  const { users, bets } = db;
  const rounds = new Map<string, RoundRecord>();

  // Same "serialize behind a tail promise" rationale as createInMemoryDb's
  // own transaction queue above -- a real DB transaction can't interleave
  // with another either.
  let tail: Promise<unknown> = Promise.resolve();

  async function runTransaction<T>(fn: (tx: RoundTx) => Promise<T>): Promise<T> {
    const stagedUsers = new Map(users);
    const stagedBets = [...bets];
    const stagedRounds = new Map(rounds);

    const tx: RoundTx = {
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
      round: {
        async create({ data }) {
          if (data.idempotencyKey) {
            for (const r of stagedRounds.values()) {
              if (r.idempotencyKey === data.idempotencyKey) {
                const err = new Error('Unique constraint failed on idempotencyKey') as Error & {
                  code: string;
                };
                err.code = 'P2002';
                throw err;
              }
            }
          }
          const round: RoundRecord = { id: nextId('round'), version: 0, ...data };
          stagedRounds.set(round.id, round);
          return round;
        },
        async findFirst({ where }) {
          const r = stagedRounds.get(where.id);
          if (!r || r.userId !== where.userId) return null;
          return r;
        },
        async updateMany({ where, data }) {
          const r = stagedRounds.get(where.id);
          if (!r || r.userId !== where.userId || r.version !== where.version) {
            return { count: 0 };
          }
          const { version, ...rest } = data;
          stagedRounds.set(where.id, { ...r, ...rest, version: r.version + version.increment });
          return { count: 1 };
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

    users.clear();
    for (const [k, v] of stagedUsers) users.set(k, v);
    bets.length = 0;
    bets.push(...stagedBets);
    rounds.clear();
    for (const [k, v] of stagedRounds) rounds.set(k, v);

    return result;
  }

  const roundDb: RoundDb & { rounds: Map<string, RoundRecord> } = {
    rounds,
    round: {
      async findFirst({ where }) {
        const r = rounds.get(where.id);
        if (!r || r.userId !== where.userId) return null;
        return r;
      },
      async findUnique({ where }) {
        for (const r of rounds.values()) {
          if (r.idempotencyKey === where.idempotencyKey) return r;
        }
        return null;
      },
    },
    $transaction<T>(fn: (tx: RoundTx) => Promise<T>): Promise<T> {
      const result = tail.then(() => runTransaction(fn));
      tail = result.catch(() => undefined);
      return result;
    },
  };

  return roundDb;
}

// Backs GET /api/me with the same `users` map createInMemoryDb already
// maintains, so a caller can seed/mutate balances via one store and read
// them back through the route.
export function createInMemoryUserDb(db: { users: Map<string, InMemoryUser> }): UserDb {
  return {
    user: {
      async findUnique({ where }) {
        const u = db.users.get(where.id);
        return u ? { id: u.id, balance: u.balance } : null;
      },
    },
  };
}

export function createInMemoryEnsureUser(
  db: { users: Map<string, InMemoryUser> },
  startingBalance = 1000
): EnsureUser {
  return {
    async ensureUser(userId: string): Promise<void> {
      if (!db.users.has(userId)) {
        db.users.set(userId, { id: userId, balance: startingBalance });
      }
    },
  };
}
