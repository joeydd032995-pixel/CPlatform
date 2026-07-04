# syntax=docker/dockerfile:1
#
# API image (@cplatform/server). Built from the repo ROOT context (the app
# depends on the other workspaces via `@cplatform/*: "*"`), so the whole
# monorepo is copied in and installed together.
#
# Note on Prisma: `prisma generate` downloads a query-engine binary from the
# network at build time. That is exactly the step that CANNOT run in the
# build sandbox this project was developed in (egress-blocked), which is why
# the image is authored here but built on a machine with internet access.
FROM node:22-bookworm-slim

# Prisma's engines need OpenSSL present at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole workspace (node_modules/.next/etc. excluded via
# .dockerignore) and install every workspace's deps. `--include=dev` is
# required, not optional: the server runs via `tsx` (a devDependency) with
# no separate build step, per this monorepo's convention.
COPY . .
RUN npm ci --include=dev

# Generate the Prisma client into the shared root node_modules (needs
# network — see the note at the top of this file).
RUN npm run --workspace @cplatform/db prisma:generate

# devEnsureUser auto-provisions a user with a starting balance only when
# NODE_ENV !== 'production' (see apps/server/src/middleware/auth.ts), which
# is what makes the platform immediately playable in this demo deployment.
# docker-compose.yml sets this too; kept here so the image is usable stand-alone.
ENV NODE_ENV=development
EXPOSE 4000

# Apply pending migrations against Postgres, then start the API. This is the
# first time the hand-authored initial migration runs against a real
# database (it could not be verified in the build sandbox).
CMD ["sh", "-lc", "npm run --workspace @cplatform/db prisma:migrate:deploy && npm run --workspace @cplatform/server start"]
