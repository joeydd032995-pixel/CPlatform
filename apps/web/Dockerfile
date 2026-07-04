# syntax=docker/dockerfile:1
#
# Web image (@cplatform/web, Next.js 15). Built from the repo ROOT context
# because it type-imports from the `@cplatform/games` workspace. No Prisma or
# database access is needed to build or run the frontend — it talks to the
# API only through Next's server-side rewrites proxy at runtime.
FROM node:22-bookworm-slim

WORKDIR /app

# Install with dev deps BEFORE setting NODE_ENV=production: the production
# build itself needs the dev toolchain (typescript, tailwind, etc.).
COPY . .
RUN npm ci --include=dev

# The API base URL is read at RUNTIME from API_PROXY_URL (see
# apps/web/next.config.ts), so no API address is baked into the build.
RUN npm run --workspace @cplatform/web build

ENV NODE_ENV=production
EXPOSE 3000

# Bind to 0.0.0.0 so the published container port is reachable from the host.
WORKDIR /app/apps/web
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
