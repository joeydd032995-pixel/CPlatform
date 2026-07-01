-- NOTE: hand-authored, not CLI-generated.
--
-- This sandbox has no network access to Prisma's engine-binary CDN and no
-- running Postgres/Docker daemon, so `prisma migrate dev` could not be run
-- to generate this migration mechanically. The SQL below was written by
-- hand to match packages/db/prisma/schema.prisma exactly, following
-- Prisma's standard Postgres migration conventions (table/constraint/index
-- naming, default onDelete/onUpdate behavior). Before relying on this in a
-- real deploy, verify it against a real `prisma migrate dev` run (or
-- `prisma migrate diff --from-migrations ./migrations --to-schema-datamodel
-- schema.prisma --script`) in an environment with full network/DB access,
-- and replace this file if anything differs.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(18,8) NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "betAmount" DECIMAL(18,8) NOT NULL,
    "payout" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "multiplier" DECIMAL(18,8) NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "outcome" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevealedSeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "finalNonce" INTEGER NOT NULL,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevealedSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bet_idempotencyKey_key" ON "Bet"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Bet_userId_timestamp_idx" ON "Bet"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "RevealedSeed_userId_rotatedAt_idx" ON "RevealedSeed"("userId", "rotatedAt");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevealedSeed" ADD CONSTRAINT "RevealedSeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
