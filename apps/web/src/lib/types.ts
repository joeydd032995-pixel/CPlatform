// Re-declared API DTOs mirroring apps/server's response shapes exactly
// (gameService.ts's PlayGameResult, seedService.ts's PublicSeedState /
// RevealedSeedRecord, and routes/verify.ts's response body). Per-game
// outcome types are re-exported (type-only) from @cplatform/games where
// available so they stay structurally in sync with the real game modules
// without ever importing runtime code from that package (see next.config.ts
// for why: @cplatform/games -> @cplatform/core-rng -> Node's `crypto`).
import type {
  MinesOutcome,
  PlinkoOutcome,
  DiceOutcome,
  RouletteOutcome,
  KenoOutcome,
  ChickenOutcome,
  DartsOutcome,
  HiLoOutcome,
  BlackjackOutcome,
  Card,
} from '@cplatform/games';

export type {
  MinesOutcome,
  PlinkoOutcome,
  DiceOutcome,
  RouletteOutcome,
  KenoOutcome,
  ChickenOutcome,
  DartsOutcome,
  HiLoOutcome,
  BlackjackOutcome,
  Card,
};

export type GameOutcome =
  | MinesOutcome
  | PlinkoOutcome
  | DiceOutcome
  | RouletteOutcome
  | KenoOutcome
  | ChickenOutcome
  | DartsOutcome
  | HiLoOutcome
  | BlackjackOutcome;

// Mirrors apps/server/src/gameService.ts's BetRecord. `betAmount`, `payout`,
// and `multiplier` are typed `unknown` server-side (Prisma Decimal without a
// generated client) but always serialize to plain numbers over the wire.
export type BetRecord = {
  id: string;
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
  idempotencyKey?: string | null;
};

// Mirrors apps/server/src/gameService.ts's PlayGameResult.
export type PlayGameResult = {
  bet: BetRecord;
  outcome: GameOutcome;
  multiplier: number;
  payout: number;
  nonce: number;
  serverSeedHash: string;
};

// Mirrors packages/core-rng/src/types.ts's RevealedSeedRecord. `rotatedAt`
// arrives as an ISO string over JSON (Date doesn't survive serialization).
export type RevealedSeedRecord = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  finalNonce: number;
  rotatedAt: string;
};

// Mirrors packages/core-rng/src/types.ts's PublicSeedState.
export type PublicSeedState = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousSeeds: RevealedSeedRecord[];
};

// Mirrors apps/server/src/routes/verify.ts's response body.
export type VerifyResponse = {
  verified: true;
  game: string;
  nonce: number;
  serverSeedHash: string;
  outcome: GameOutcome;
  multiplier: number;
};

// Mirrors apps/server/src/routes/me.ts's response body.
export type MeResponse = {
  userId: string;
  balance: number;
};

// Mirrors apps/server/src/roundService.ts's RoundStatus + public
// projections exactly. These are the redacted views a Mines/Blackjack round
// endpoint returns -- never the hidden server-side state (mine positions,
// dealer hole card before it's legitimately revealed).
export type RoundStatus = 'OPEN' | 'CASHED_OUT' | 'BUSTED' | 'SETTLED';

export type MinesRoundView = {
  id: string;
  game: 'mines';
  status: RoundStatus;
  betAmount: number;
  mines: number;
  revealedTiles: number[];
  minePositions: number[] | null;
  currentMultiplier: number;
  payout: number | null;
  version: number;
};

export type BlackjackHandView = {
  cards: Card[];
  bet: number;
  status: string;
  isSplitAce?: boolean;
  result?: 'blackjack' | 'win' | 'push' | 'lose';
  payout?: number;
};

export type BlackjackRoundView = {
  id: string;
  game: 'blackjack';
  status: RoundStatus;
  betAmount: number;
  hands: BlackjackHandView[];
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

export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'insurance';

// Mirrors apps/server/src/middleware/errorHandler.ts's error JSON shape
// (AppError branch + ZodError branch both include `code`/`error`; the
// validation branch additionally includes `issues`).
export type ApiErrorBody = {
  code: string;
  error: string;
  issues?: string[];
};
