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
