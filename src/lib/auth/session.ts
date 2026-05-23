/**
 * Session helpers — magic-link emission + session cookie management.
 *
 * Magic-link tokens have a short TTL (15 min) — just long enough for
 * the operator to click through from email. The session cookie set
 * after verification has a long TTL (30 days). Both are HMAC-signed
 * with the same secret; cookies are HttpOnly + Secure + SameSite=Lax.
 */

import { cookies } from "next/headers";
import { signToken, verifyToken } from "./hmac";

export const SESSION_COOKIE = "farley_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a magic-link token bound to an email. Returns the token
 * string to embed in a URL like `/api/auth/verify?t=<token>`.
 */
export function generateMagicLinkToken(email: string): string {
  return signToken(`magic:${email.toLowerCase()}`, MAGIC_LINK_TTL_MS);
}

/**
 * Verify a magic-link token and return the bound email, or null on
 * any failure (bad signature, expired, malformed, wrong kind).
 */
export function verifyMagicLinkToken(token: string): string | null {
  const result = verifyToken(token);
  if (!result.valid) return null;
  const [kind, ...rest] = result.data.split(":");
  if (kind !== "magic") return null;
  return rest.join(":");
}

/**
 * Generate a session cookie value for an authenticated operator email.
 */
export function generateSessionValue(email: string): string {
  return signToken(`session:${email.toLowerCase()}`, SESSION_TTL_MS);
}

/**
 * Verify a session cookie value and return the bound email, or null.
 */
export function verifySessionValue(value: string): string | null {
  const result = verifyToken(value);
  if (!result.valid) return null;
  const [kind, ...rest] = result.data.split(":");
  if (kind !== "session") return null;
  return rest.join(":");
}

/**
 * Set the session cookie on the current response.
 * Call from a route handler (API route or server action).
 */
export async function setSessionCookie(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: generateSessionValue(email),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get the current operator's email from the session cookie, or null
 * if no valid session is present.
 */
export async function getCurrentOperatorEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifySessionValue(value);
}
