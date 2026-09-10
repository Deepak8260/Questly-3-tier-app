/**
 * Runtime-safe accessor for public (browser-exposed) config.
 *
 * Why this exists:
 * Next.js normally inlines `process.env.NEXT_PUBLIC_*` values into the
 * client JS bundle at BUILD time. That means a Docker image built once
 * would have those values baked in forever, and changing them later
 * would force a full rebuild.
 *
 * Instead, the container's entrypoint (see docker-entrypoint.js) writes
 * the current values of these env vars into /public/__ENV.js at
 * CONTAINER START time, as `window.__ENV__ = {...}`. That script is
 * loaded in app/layout.tsx before hydration. This file reads from
 * `window.__ENV__` in the browser, so the same built image can be run
 * with different env values without rebuilding.
 *
 * On the server (SSR / route handlers), `window` doesn't exist, so we
 * fall back to `process.env` directly, which Node reads at runtime
 * anyway (no baking issue server-side for non-NEXT_PUBLIC vars).
 */

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

export function getPublicEnv(key: string): string {
  if (typeof window !== "undefined" && window.__ENV__) {
    return window.__ENV__[key] ?? "";
  }
  return process.env[key] ?? "";
}
