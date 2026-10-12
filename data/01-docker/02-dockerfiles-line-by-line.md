# Questly Dockerfiles – Line by Line (Version 1 → Final)

Flow of this file

- Version 1 – Copy everything (single stage)
- Version 2 – Multi-stage + distroless + build args
- The fix – docker-entrypoint.js
- Final version – Build once, run anywhere

---

# Version 1 – Copy everything (single stage)

## frontend/Dockerfile (v1)

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

| Line | What it does |
|---|---|
| `FROM node:22-slim` | Start from an image that already has Node.js 22 on a small Linux system. |
| `WORKDIR /app` | Create the `/app` folder and run every next command inside it. |
| `COPY package*.json ./` | Copy only `package.json` and `package-lock.json` first. |
| `RUN npm install` | Download every dependency listed in `package.json` (including dev dependencies). |
| `COPY . .` | Copy everything else from the project folder into `/app`. |
| `RUN npm run build` | Run `next build` to create the production build in `.next/`. |
| `EXPOSE 3000` | Document that the app listens on port 3000. |
| `CMD ["npm", "start"]` | When the container starts, run `npm start` (which runs `next start`). |

## backend/Dockerfile (v1)

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

| Line | What it does |
|---|---|
| `FROM node:22-slim` | Same Node.js 22 base image. |
| `WORKDIR /app` | Work inside `/app`. |
| `COPY package*.json ./` | Copy dependency files first. |
| `RUN npm install` | Install all dependencies, including TypeScript and other dev tools. |
| `COPY . .` | Copy the whole backend source code. |
| `RUN npm run build` | Run `tsc` to compile TypeScript into JavaScript in `dist/`. |
| `EXPOSE 3001` | Document that the API listens on port 3001. |
| `CMD ["npm", "start"]` | Start with `npm start`, which runs `node dist/index.js`. |

## Run commands (v1)

```bash
cd backend
docker build -t questly-backend .
docker run -d --name questly-backend -p 3001:3001 questly-backend

cd ../frontend
docker build -t questly-frontend .
docker run -d --name questly-frontend -p 3000:3000 questly-frontend
```

| Command part | Meaning |
|---|---|
| `docker build -t questly-backend .` | Build an image from the Dockerfile in the current folder and name it `questly-backend`. |
| `docker run -d` | Start a container in the background. |
| `--name questly-backend` | Give the container a fixed name. |
| `-p 3001:3001` | Map port 3001 on the laptop to port 3001 in the container. |

## Problems with v1

- `COPY . .` copies the whole laptop folder: `.env`, `node_modules`, `.git`, `.next`
- `.env` secrets end up inside the image, so anyone who pulls it can read them
- The runtime image still has the full build toolchain: npm, shell, dev dependencies
- Image is huge (~1.7 GB for the frontend)
- Bigger image = slower push, pull and deploy, and more attack surface

---

# Version 2 – Multi-stage + distroless + build args

## .dockerignore

**frontend/.dockerignore**

```
node_modules
.next
.env
.git
.gitignore
README.md
```

**backend/.dockerignore**

```
node_modules
dist
.env
.git
.gitignore
README.md
```

| Entry | Why it is ignored |
|---|---|
| `node_modules` | Dependencies are installed fresh inside the image. |
| `.next` / `dist` | Build output is created fresh inside the image. |
| `.env` | Secrets must never go into the image. |
| `.git`, `.gitignore`, `README.md` | Not needed to run the app. |

`.dockerignore` works like `.gitignore`, but for `COPY . .`.

## frontend/Dockerfile (v2)

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

### Builder stage

| Line | What it does |
|---|---|
| `FROM node:22-slim AS builder` | First stage. Has Node and npm. Named `builder` so the next stage can copy from it. |
| `WORKDIR /app` | Work inside `/app`. |
| `ARG NEXT_PUBLIC_SUPABASE_URL` | Accept the Supabase URL as a value passed with `--build-arg`. |
| `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accept the Supabase public (anon) key. |
| `ARG NEXT_PUBLIC_API_BASE_URL` | Accept the backend API URL. |
| `ENV NEXT_PUBLIC_SUPABASE_URL=${...}` | Turn the ARG into an environment variable so `next build` can see it. |
| `ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${...}` | Same for the anon key. |
| `ENV NEXT_PUBLIC_API_BASE_URL=${...}` | Same for the API URL. |
| `COPY package*.json ./` | Copy dependency files first, so Docker can reuse the install layer from cache. |
| `RUN npm ci` | Clean install of the exact versions in `package-lock.json`. |
| `COPY . .` | Copy source code (`.dockerignore` keeps `.env` out). |
| `RUN npm run build` | `next build`. With `output: "standalone"` in `next.config.ts`, this creates `.next/standalone`: a small `server.js` plus only the dependencies the app really uses. The `NEXT_PUBLIC_*` values are written into the browser JavaScript here. |

**ARG vs ENV**

| | ARG | ENV |
|---|---|---|
| Exists when | Only while building | While building and inside the stage |
| Set with | `--build-arg KEY=value` | `ENV KEY=value` in the Dockerfile |
| Used here for | Receiving the value | Making `next build` see the value |

### Runner stage

| Line | What it does |
|---|---|
| `FROM gcr.io/distroless/nodejs22-debian12` | Second stage. Only the Node.js runtime: no shell, no npm, no apt. Small and secure. |
| `WORKDIR /app` | Work inside `/app`. |
| `COPY --from=builder /app/.next/standalone ./` | Take only the standalone server from the builder stage. |
| `COPY --from=builder /app/.next/static ./.next/static` | Take the compiled JS/CSS files (standalone does not include them). |
| `COPY --from=builder /app/public ./public` | Take images and other public files. |
| `EXPOSE 3000` | Document port 3000. |
| `CMD ["server.js"]` | Distroless already starts with `node`, so this runs `node server.js`. |

Everything else in the builder stage (npm, dev dependencies, source code, cache) is thrown away.

## backend/Dockerfile (v2)

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

### Builder stage

| Line | What it does |
|---|---|
| `FROM node:22-slim AS builder` | Build stage with Node and npm. |
| `WORKDIR /app` | Work inside `/app`. |
| `COPY package*.json ./` | Copy dependency files first for caching. |
| `RUN npm ci` | Install all dependencies, including TypeScript (needed to compile). |
| `COPY . .` | Copy the backend source code. |
| `RUN npm run build` | `tsc` compiles `src/*.ts` into `dist/*.js`. |
| `RUN npm prune --omit=dev` | Delete dev dependencies (TypeScript, ts-node-dev, type packages). Only production packages stay in `node_modules`. |

### Runner stage

| Line | What it does |
|---|---|
| `FROM gcr.io/distroless/nodejs22-debian12` | Minimal Node.js runtime, no shell or npm. |
| `WORKDIR /app` | Work inside `/app`. |
| `COPY --from=builder /app/node_modules ./node_modules` | Bring only production dependencies (express, cors, dotenv, supabase-js). |
| `COPY --from=builder /app/dist ./dist` | Bring the compiled JavaScript. |
| `COPY --from=builder /app/package.json ./` | Bring `package.json` (project metadata). |
| `EXPOSE 3001` | Document port 3001. |
| `CMD ["dist/index.js"]` | Runs `node dist/index.js`. |

No `ARG` here: the backend reads its secrets from `process.env` while it runs, so they are passed at `docker run`.

## Run commands (v2)

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

| Command part | Meaning |
|---|---|
| `docker network create qnet` | Create a private network so containers can reach each other by name. |
| `--network qnet` | Attach the container to that network. |
| `--env-file .env` | Pass the backend secrets at run time (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`). |
| `--build-arg KEY=value` | Pass a value into the matching `ARG` during the build. |
| `\` | Continue the command on the next line. |

## What improved in v2

- Image size ~1.7 GB → ~311 MB (frontend)
- No shell, npm or dev dependencies in the final image
- `.env` no longer copied into the image
- Backend secrets passed only at run time

## Problem left in v2 (frontend only)

- `NEXT_PUBLIC_*` values are written into the JavaScript during `next build`
- Change a URL or key → must rebuild the image
- The same image cannot be used for dev, staging and prod
- Build-arg values can be seen in the image build history

---

# The fix – docker-entrypoint.js

## frontend/docker-entrypoint.js

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

| Code | What it does |
|---|---|
| `#!/usr/bin/env node` | Marks the file as a Node.js script. |
| `/** ... */` | Comment explaining the file. |
| `const fs = require("fs")` | Load Node's file-system module (to write files). |
| `const path = require("path")` | Load Node's path module (to build file paths safely). |
| `const PUBLIC_ENV_KEYS = [...]` | The 3 values the browser needs. Only public values, never secrets. |
| `const publicEnv = {}` | Empty object to collect the values. |
| `for (const key of PUBLIC_ENV_KEYS)` | Loop over the 3 keys. |
| `publicEnv[key] = process.env[key] ?? ""` | Read each value from the container's environment; use an empty string if it is missing. |
| `const missing = ...filter(...)` | Find keys that came in empty. |
| `if (missing.length) { console.warn(...) }` | Print a warning in the container logs so a missing value is easy to spot. |
| `const publicDir = path.join(__dirname, "public")` | Path to `/app/public`. |
| `fs.mkdirSync(publicDir, { recursive: true })` | Make sure the folder exists. |
| `fs.writeFileSync(..."__ENV.js", ...)` | Write `/app/public/__ENV.js` containing `window.__ENV__ = { ... }`. |
| `JSON.stringify(publicEnv, null, 2)` | Turn the object into readable JSON text. |
| `console.log(...)` | Log that the file was written. |
| `require("./server.js")` | Start the Next.js standalone server. |

## frontend/app/layout.tsx – loads it in the browser

```tsx
<script src="/__ENV.js" />
```

| Code | What it does |
|---|---|
| `<script src="/__ENV.js" />` | Browser downloads `__ENV.js` before the app runs, which sets `window.__ENV__`. |

## frontend/lib/env.ts – reads it

```ts
export function getPublicEnv(key: string): string {
  if (typeof window !== "undefined" && window.__ENV__) {
    return window.__ENV__[key] ?? "";
  }
  return process.env[key] ?? "";
}
```

| Code | What it does |
|---|---|
| `export function getPublicEnv(key: string)` | One function the whole app uses to read a public setting. |
| `typeof window !== "undefined"` | True only in the browser. |
| `&& window.__ENV__` | And only if `__ENV.js` has loaded. |
| `return window.__ENV__[key] ?? ""` | In the browser: read the value written at container start. |
| `return process.env[key] ?? ""` | On the server (Next.js Node process): read the container env directly. |

## How the flow works

```
docker run --env-file .env questly-frontend
        ↓
node docker-entrypoint.js
        ↓
reads NEXT_PUBLIC_* from container env
        ↓
writes /app/public/__ENV.js  →  window.__ENV__ = {...}
        ↓
require("./server.js")  →  Next.js starts
        ↓
browser loads /__ENV.js
        ↓
getPublicEnv("NEXT_PUBLIC_API_BASE_URL") reads window.__ENV__
```

## How it solved the problem

- Values are read when the container **starts**, not when the image is built
- Nothing is baked into the image
- Change a value → restart the container, no rebuild
- Plain Node.js file → works on distroless (no shell needed)

---

# Final version – Build once, run anywhere

## frontend/Dockerfile (final)

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

| Line | What changed from v2 |
|---|---|
| `ARG ...` / `ENV ...` lines | **Removed.** The build no longer needs any config values. |
| `COPY package*.json ./` → `RUN npm run build` | Same as v2. |
| `COPY --from=builder ... standalone / static / public` | Same as v2. |
| `COPY --from=builder /app/docker-entrypoint.js ./docker-entrypoint.js` | **New.** Bring the entrypoint script into the final image. |
| `CMD ["docker-entrypoint.js"]` | **Changed.** Start the entrypoint (which then starts `server.js`) instead of `server.js` directly. |

## backend/Dockerfile (final)

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

| Line | What changed from v2 |
|---|---|
| All instructions | **Same as v2.** Only comments changed. |
| Comment block | Explains that secrets are read from `process.env` at run time, never at build time. |

The backend never needed an entrypoint: Node.js reads `process.env` directly inside the container.

## Run commands (final)

```bash
docker network create qnet

cd backend
docker build -t questly-backend .
docker run -d --name questly-backend --network qnet -p 3001:3001 --env-file .env questly-backend

cd ../frontend
docker build -t questly-frontend .
docker run -d --name questly-frontend --network qnet -p 3000:3000 --env-file .env questly-frontend
```

| What changed from v2 | Why |
|---|---|
| Frontend `docker build` has no `--build-arg` | Nothing is baked in at build time. |
| Frontend `docker run` has `--env-file .env` | The entrypoint reads the 3 `NEXT_PUBLIC_*` values when the container starts. |

## Result

- Same image for dev, staging and prod
- Change config = restart the container, no rebuild
- No secrets inside any image
- Small, secure distroless images

---

# Summary – v1 vs v2 vs final

| | v1 | v2 | Final |
|---|---|---|---|
| Stages | 1 | 2 (builder + runner) | 2 (builder + runner) |
| Runtime base | `node:22-slim` | distroless | distroless |
| `.env` in image | Yes | No | No |
| Frontend config | — | Baked at build (`ARG`) | Injected at start (entrypoint) |
| Backend config | — | Runtime (`--env-file`) | Runtime (`--env-file`) |
| Frontend size | ~1.7 GB | ~311 MB | ~311 MB |
| Config change needs rebuild | Yes | Yes (frontend) | No |
