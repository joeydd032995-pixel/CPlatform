-- NOTE: hand-authored, not CLI-generated.
--
-- This sandbox has no network access to Prisma's engine-binary CDN and no
-- running Postgres/Docker daemon, so `prisma migrate dev` could not be run
-- to generate this migration mechanically. The SQL below was written by
-- hand to match packages/db/prisma/schema.prisma exactly, following the
-- same conventions as 20260701000000_init/migration.sql. Before relying on
-- this in a real deploy, verify it against a real `prisma migrate dev` run
-- (or `prisma migrate diff --from-migrations ./migrations --to-schema-datamodel
-- schema.prisma --script`) in an environment with full network/DB access,
-- and replace this file if anything differs.
--
-- Purely additive: new enum + new table + one new relation field on User.
-- No existing table/column is touched.

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'CASHED_OUT', 'BUSTED', 'SETTLED');

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "betAmount" DECIMAL(18,8) NOT NULL,
    "payout" DECIMAL(18,8),
    "multiplier" DECIMAL(18,8),
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "startParams" JSONB NOT NULL,
    "serverState" JSONB NOT NULL,
    "actionLog" JSONB NOT NULL DEFAULT '[]',
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Round_idempotencyKey_key" ON "Round"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Round_userId_status_idx" ON "Round"("userId", "status");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
