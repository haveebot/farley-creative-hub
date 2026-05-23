/**
 * HMAC helpers for magic-link tokens and session cookies.
 *
 * Stateless auth — no database lookup needed. The token IS the
 * credential. Server signs with AUTH_HMAC_SECRET; verification is
 * constant-time and includes an expiry check.
 *
 * Same pattern as PAL's locals-hmac.ts, generalized for session use.
 */

import crypto from "crypto";

const ENCODING: BufferEncoding = "base64url";

function getSecret(): string {
  const secret = process.env.AUTH_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_HMAC_SECRET not set. Generate one with `openssl rand -hex 32` and add to Vercel env vars.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest(ENCODING);
}

/**
 * Create a signed token. Payload is `<data>:<expiryUnixMs>` and the
 * full token is `<data>:<expiryUnixMs>:<signature>`.
 *
 * @param data - the payload to bind (e.g. an email address)
 * @param ttlMs - lifetime in ms from now
 */
export function signToken(data: string, ttlMs: number): string {
  const expiry = Date.now() + ttlMs;
  const payload = `${data}:${expiry}`;
  const sig = sign(payload);
  return `${payload}:${sig}`;
}

export type TokenVerification =
  | { valid: true; data: string; expiry: number }
  | { valid: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Verify a signed token. Constant-time HMAC check + expiry check.
 */
export function verifyToken(token: string): TokenVerification {
  const parts = token.split(":");
  if (parts.length < 3) return { valid: false, reason: "malformed" };

  const sig = parts[parts.length - 1];
  const expiryStr = parts[parts.length - 2];
  const data = parts.slice(0, parts.length - 2).join(":");

  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry)) return { valid: false, reason: "malformed" };

  const expected = sign(`${data}:${expiry}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { valid: false, reason: "bad-signature" };
  if (!crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }

  if (Date.now() > expiry) return { valid: false, reason: "expired" };

  return { valid: true, data, expiry };
}
