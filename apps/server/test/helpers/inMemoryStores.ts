// The in-memory store implementations were promoted from this test helper
// into src/inMemoryStores.ts when DEMO_MODE (createApp.ts) started using
// them in production. This file re-exports them under the names the test
// suite has always used, so tests stay unchanged and there is exactly one
// implementation to keep faithful.
export {
  InMemorySeedStore,
  InMemoryIdempotencyStore,
  InMemoryRateLimitCounter,
  createInMemoryDb as createFakeDb,
  createInMemoryRoundDb as createFakeRoundDb,
  createInMemoryUserDb as createFakeUserDb,
  createInMemoryEnsureUser as createFakeEnsureUser,
} from '../../src/inMemoryStores.js';
