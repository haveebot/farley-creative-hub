/**
 * Demo mode detection. Set DEMO_MODE=true in the env to flip the
 * deployment into demo posture:
 *   - Middleware bypasses session auth (anyone can view)
 *   - Mutating endpoints (POST/PATCH/PUT/DELETE) return 403 read-only
 *   - Cron endpoints no-op
 *   - UI shows a banner explaining this is a demo
 *
 * The same codebase runs in both modes; only the env flag + Neon
 * DB differ between the production FC Hub and fcdemohub.com.
 */

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export const DEMO_READONLY_MESSAGE =
  "This is a demo Hub — changes don't persist. Everything you see is realistic sample content.";
