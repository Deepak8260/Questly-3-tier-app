# ============================================
# Builder Stage
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm prune --omit=dev

# ============================================
# Runner Stage
# ============================================
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Production dependencies + compiled output only.
# No secrets are copied in or read at build time: PORT, GEMINI_API_KEY,
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY etc. are all read from
# process.env at request/startup time (see src/index.ts, dotenv.config()),
# so they only need to be supplied at `docker run` / compose time.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3001

CMD ["dist/index.js"]
