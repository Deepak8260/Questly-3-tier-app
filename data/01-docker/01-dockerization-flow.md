# Questly – Dockerization Flow

---

## Version 1 – Copy everything (single stage)

### frontend/Dockerfile

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### backend/Dockerfile

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### Run commands

```bash
cd backend
docker build -t questly-backend .
docker run -d --name questly-backend -p 3001:3001 questly-backend

cd ../frontend
docker build -t questly-frontend .
docker run -d --name questly-frontend -p 3000:3000 questly-frontend
```

### Demerits

- `COPY . .` copies the whole laptop folder: `.env`, `node_modules`, `.git`, `.next`
- `.env` secrets end up inside the image
- Anyone who pulls the image can read the secrets
- Image is huge (~1.7 GB): full Node + shell + npm + dev dependencies
- Dev dependencies and build tools ship to production
- Any code change reinstalls/rebuilds a lot
- Bigger image = slower push, pull and deploy, more attack surface

---

## Version 2 – Multi-stage + distroless + build args

### .dockerignore (frontend)

```
node_modules
.next
.env
.git
.gitignore
README.md
```

### .dockerignore (backend)

```
node_modules
dist
.env
.git
.gitignore
README.md
```

- `.env` is no longer copied into the image

### frontend/Dockerfile

```dockerfile
# ============================================
# Builder Stage
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# Accept build arguments
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_BASE_URL

# Make them available during the build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build Next.js application
RUN npm run build


# ============================================
# Runner Stage
# ============================================
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Copy standalone application
COPY --from=builder /app/.next/standalone ./

# Copy static assets
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]
```

### backend/Dockerfile

```dockerfile
# ============================================
# Builder Stage
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript project
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev


# ============================================
# Runner Stage
# ============================================
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy package.json
COPY --from=builder /app/package.json ./

EXPOSE 3001

CMD ["dist/index.js"]
```

### Run commands

```bash
docker network create qnet

cd backend
docker build -t questly-backend .
docker run -d --name questly-backend --network qnet -p 3001:3001 --env-file .env questly-backend

cd ../frontend
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 \
  -t questly-frontend .
docker run -d --name questly-frontend --network qnet -p 3000:3000 questly-frontend
```

### What improved

- Image size ~1.7 GB → ~311 MB
- Distroless: no shell, no npm, no apt
- Backend secrets passed at runtime with `--env-file`

### Remaining problem (frontend only)

- `NEXT_PUBLIC_*` values are baked into the JS at build time
- Changing a URL or key = rebuild the image
- One image cannot be reused for dev / staging / prod
- Build args are visible in image build history

---

## The Fix – docker-entrypoint.js

### frontend/docker-entrypoint.js

```js
#!/usr/bin/env node
/**
 * Entrypoint for the frontend PRODUCTION image (distroless, no shell).
 *
 * Runs at `docker run` / container-start time, NOT at `docker build`
 * time. It writes /app/public/__ENV.js from whatever env vars the
 * container was started with, then boots the Next.js standalone
 * server. This is what lets NEXT_PUBLIC_* values be supplied only at
 * `docker run` (or via compose `environment:` / `env_file:`) — the
 * image itself contains no baked-in secrets, so changing env values
 * never requires a rebuild.
 */
const fs = require("fs");
const path = require("path");

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_API_BASE_URL",
];

const publicEnv = {};
for (const key of PUBLIC_ENV_KEYS) {
  publicEnv[key] = process.env[key] ?? "";
}

const missing = PUBLIC_ENV_KEYS.filter((k) => !publicEnv[k]);
if (missing.length) {
  console.warn(
    `[docker-entrypoint] Warning: missing values for: ${missing.join(", ")}. ` +
      `Pass them with 'docker run -e KEY=value ...' or a compose 'env_file:'/'environment:' entry.`
  );
}

const publicDir = path.join(__dirname, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, "__ENV.js"),
  `window.__ENV__ = ${JSON.stringify(publicEnv, null, 2)};\n`
);
console.log("[docker-entrypoint] wrote public/__ENV.js from runtime env");

require("./server.js");
```

### frontend/app/layout.tsx (loads it in the browser)

```tsx
<script src="/__ENV.js" />
```

### frontend/lib/env.ts (reads it)

```ts
export function getPublicEnv(key: string): string {
  if (typeof window !== "undefined" && window.__ENV__) {
    return window.__ENV__[key] ?? "";
  }
  return process.env[key] ?? "";
}
```

### How it solved the problem

- Runs when the container **starts**, not when the image is built
- Reads the 3 `NEXT_PUBLIC_*` values from the container env
- Writes them to `public/__ENV.js` as `window.__ENV__`
- Browser loads `__ENV.js` → `getPublicEnv()` reads values from it
- Then starts the Next.js server (`server.js`)
- Plain Node.js → works on distroless (no shell needed)
- No build args → nothing baked in → build once, run anywhere

---

## Final Version

### frontend/Dockerfile

```dockerfile
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
```

### backend/Dockerfile

```dockerfile
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
```

### Run commands

```bash
docker network create qnet

cd backend
docker build -t questly-backend .
docker run -d --name questly-backend --network qnet -p 3001:3001 --env-file .env questly-backend

cd ../frontend
docker build -t questly-frontend .
docker run -d --name questly-frontend --network qnet -p 3000:3000 --env-file .env questly-frontend
```

### Result

- Same image for every environment
- Change config = restart container, no rebuild
- No secrets inside any image
- Small, secure distroless images
