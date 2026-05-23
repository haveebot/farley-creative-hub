/**
 * Server-only session helpers — wraps the edge-safe token helpers
 * with `next/headers` cookie operations. Import only from server
 * components, route handlers, and server actions — NOT from
 * middleware (use `./session-tokens.ts` there).
 */

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateSessionValue,
  verifySessionValue,
} from "./session-tokens";

export { SESSION_COOKIE, verifySessionValue };

/**
 * Set the session cookie on the current response.
 */
export async function setSessionCookie(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: await generateSessionValue(email),
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
 * if no valid session is present. Server-side only.
 */
export async function getCurrentOperatorEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return await verifySessionValue(value);
}
