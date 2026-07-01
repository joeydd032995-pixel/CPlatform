// Shared seed-state types consumed by seedService.ts / gameService.ts.
// Previously referenced (../../core/types) by the seedService.ts reference
// doc but never authored — this is that missing file.

export type RevealedSeedRecord = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  finalNonce: number;
  rotatedAt: Date;
};

export type UserSeedState = {
  userId: string;
  activeServerSeed: string;
  activeServerSeedHash: string;
  activeClientSeed: string;
  currentNonce: number;
  previousSeeds: RevealedSeedRecord[];
};

export type PublicSeedState = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousSeeds: RevealedSeedRecord[];
};
