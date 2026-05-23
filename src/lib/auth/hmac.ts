/**
 * HMAC helpers for magic-link tokens and session cookies.
 *
 * Uses the Web Crypto API (`globalThis.crypto.subtle`) so the same
 * code works in both Node (API routes) and Edge (middleware) runtimes.
 * Functions are async because SubtleCrypto is async.
 *
 * Stateless auth — no database lookup needed. The token IS the
 * credential. Verification is constant-time and includes an expiry check.
 */

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_HMAC_SECRET not set. Generate one with `openssl rand -hex 32` and add to Vercel env vars.",
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in both Node 18+ and Edge runtime.
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufferToBase64Url(sig);
}

/**
 * Constant-time string comparison. Not perfectly constant-time at the
 * JS level, but good enough for HMAC signature checks where lengths
 * are equal and timing differences are dominated by network jitter.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create a signed token. Payload is `<data>:<expiryUnixMs>` and the
 * full token is `<data>:<expiryUnixMs>:<signature>`.
 */
export async function signToken(data: string, ttlMs: number): Promise<string> {
  const expiry = Date.now() + ttlMs;
  const payload = `${data}:${expiry}`;
  const sig = await sign(payload);
  return `${payload}:${sig}`;
}

export type TokenVerification =
  | { valid: true; data: string; expiry: number }
  | { valid: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Verify a signed token. Constant-time HMAC check + expiry check.
 */
export async function verifyToken(token: string): Promise<TokenVerification> {
  const parts = token.split(":");
  if (parts.length < 3) return { valid: false, reason: "malformed" };

  const sig = parts[parts.length - 1];
  const expiryStr = parts[parts.length - 2];
  const data = parts.slice(0, parts.length - 2).join(":");

  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry)) return { valid: false, reason: "malformed" };

  const expected = await sign(`${data}:${expiry}`);
  if (!timingSafeEqualStrings(sig, expected)) {
    return { valid: false, reason: "bad-signature" };
  }
  if (Date.now() > expiry) return { valid: false, reason: "expired" };

  return { valid: true, data, expiry };
}
