/**
 * Session token sign/verify — edge-safe (no Next.js cookie deps).
 *
 * Lives separate from `session.ts` so middleware (edge runtime) can
 * import only the HMAC pieces without dragging in `next/headers`
 * cookie APIs (which are server-only).
 *
 * Async because the underlying HMAC helpers use Web Crypto.
 */

import { signToken, verifyToken } from "./hmac";

export const SESSION_COOKIE = "farley_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function generateSessionValue(email: string): Promise<string> {
  return signToken(`session:${email.toLowerCase()}`, SESSION_TTL_MS);
}

export async function verifySessionValue(value: string): Promise<string | null> {
  const result = await verifyToken(value);
  if (!result.valid) return null;
  const [kind, ...rest] = result.data.split(":");
  if (kind !== "session") return null;
  return rest.join(":");
}
