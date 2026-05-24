/**
 * SHA-256 helpers — Web Crypto, works in both Node and Edge runtimes.
 * Used to hash agent tokens for at-rest storage. Token plaintext is
 * 32+ bytes of entropy so a single hash is sufficient (no salting
 * needed; no rainbow-table risk at that entropy).
 */

const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Generate a new agent token. Format: `fch_<64 hex chars>` (68 total).
 * 32 bytes of random entropy → unguessable.
 */
export function generateAgentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return `fch_${hex}`;
}

/**
 * Display-friendly prefix for an existing token. First 12 chars
 * (the `fch_` + 8 hex) so operators can tell tokens apart in the UI
 * without exposing the full secret.
 */
export function tokenPrefix(token: string): string {
  return token.slice(0, 12);
}
