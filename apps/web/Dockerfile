# syntax=docker/dockerfile:1
#
# Web image (@cplatform/web, Next.js 15). Built from the repo ROOT context
# because it type-imports from the `@cplatform/games` workspace. No Prisma or
# database access is needed to build or run the frontend — it talks to the
# API only through Next's server-side rewrites proxy.
FROM node:22-bookworm-slim

WORKDIR /app

# Install with dev deps BEFORE setting NODE_ENV=production: the production
# build itself needs the dev toolchain (typescript, tailwind, etc.).
COPY . .
RUN npm ci --include=dev

# IMPORTANT: next.config.ts's rewrites() reads API_PROXY_URL, but Next.js
# resolves rewrites/redirects/headers ONCE at `next build` time and bakes the
# result into .next/routes-manifest.json. Setting this as a docker-compose
# `environment:` var (a runtime-only mechanism) has NO effect on an
# already-built image -- it must be present at build time. Default matches
# this repo's docker-compose.yml service name ("api"); override with
# `docker build --build-arg API_PROXY_URL=...` for a different topology.
ARG API_PROXY_URL=http://api:4000
ENV API_PROXY_URL=$API_PROXY_URL

RUN npm run --workspace @cplatform/web build

ENV NODE_ENV=production
EXPOSE 3000

# Bind to 0.0.0.0 so the published container port is reachable from the host.
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
