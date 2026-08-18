#!/usr/bin/env node
/**
 * Writes public/__ENV.js with the current values of the app's
 * NEXT_PUBLIC_* variables, read from the process environment at the
 * moment this script runs (NOT at Docker image build time).
 *
 * Used in two places:
 *  - locally, via the "predev" / "prestart" npm script (reads a local
 *    .env file if present, for convenience)
 *  - in Docker, via docker-entrypoint.js at container start (reads
 *    whatever the container was run/composed with, e.g. `docker run
 *    --env-file .env` or a compose `env_file:` — no .env file is baked
 *    into the image, see .dockerignore)
 *
 * This is plain CommonJS with no dependencies so it runs unmodified
 * under the distroless Node runtime used by the production image.
 */
const fs = require("fs");
const path = require("path");

// Best-effort: if a .env file exists next to this script's project
// root, load KEY=VALUE pairs from it WITHOUT overriding anything
// already set in the real environment (docker/compose values win).
function loadDotEnvIfPresent(rootDir) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_API_BASE_URL",
];

function main() {
  // rootDir: project root when run locally (scripts/../), or /app when
  // run from docker-entrypoint.js in the container.
  const rootDir = process.argv[2] || path.join(__dirname, "..");
  const outDir = process.argv[3] || path.join(rootDir, "public");

  loadDotEnvIfPresent(rootDir);

  const publicEnv = {};
  for (const key of PUBLIC_ENV_KEYS) {
    publicEnv[key] = process.env[key] ?? "";
  }

  const missing = PUBLIC_ENV_KEYS.filter((k) => !publicEnv[k]);
  if (missing.length) {
    console.warn(
      `[generate-public-env] Warning: missing values for: ${missing.join(", ")}. ` +
        `Set them via 'docker run -e ...' / compose 'environment:'/'env_file:' at container start.`
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  const contents = `window.__ENV__ = ${JSON.stringify(publicEnv, null, 2)};\n`;
  fs.writeFileSync(path.join(outDir, "__ENV.js"), contents);
  console.log(`[generate-public-env] wrote ${path.join(outDir, "__ENV.js")}`);
}

main();
