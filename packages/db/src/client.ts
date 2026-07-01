import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __cplatformPrisma: PrismaClient | undefined;
}

// Singleton pattern: avoids exhausting the Postgres connection pool when
// this module gets re-imported across dev-server hot reloads or multiple
// workspace packages resolving the same module instance.
export const prisma: PrismaClient = globalThis.__cplatformPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__cplatformPrisma = prisma;
}

export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
