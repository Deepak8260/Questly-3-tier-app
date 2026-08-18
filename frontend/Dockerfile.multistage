# ============================================
# Builder Stage
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# No build ARGs / ENVs here on purpose: NEXT_PUBLIC_* values are no
# longer read at build time (see lib/env.ts + docker-entrypoint.js).
# The build only needs source + deps, never secrets.

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ============================================
# Runner Stage
# ============================================
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Standalone server + static assets + public folder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Runtime entrypoint: writes public/__ENV.js from the container's env
# vars, then starts the server. All env values are supplied at
# `docker run` / compose time, not baked into this image.
COPY --from=builder /app/docker-entrypoint.js ./docker-entrypoint.js

EXPOSE 3000

CMD ["docker-entrypoint.js"]
