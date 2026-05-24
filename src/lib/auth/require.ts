/**
 * requireAuth — single helper used by every API route to accept
 * either a session cookie (UI) or a Bearer token (agent).
 *
 * Returns a context describing who's calling, or a 401 Response that
 * the route should immediately return.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof Response) return auth;
 *   // auth.type === "user" | "agent"
 */

import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, verifySessionValue } from "./session-tokens";
import { verifyAgentToken } from "@/lib/db/agent-tokens";

export type AuthContext =
  | { type: "user"; email: string }
  | { type: "agent"; tokenId: number; tokenName: string };

export async function requireAuth(): Promise<AuthContext | Response> {
  // 1. Bearer token (agent) — try first so agent calls don't depend on cookies.
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const agent = await verifyAgentToken(token);
      if (agent) {
        return { type: "agent", tokenId: agent.id, tokenName: agent.name };
      }
      // Bearer header present but invalid — reject explicitly so the
      // caller doesn't silently fall through to cookie auth (which they
      // likely don't have anyway).
      return new Response(JSON.stringify({ error: "invalid-token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 2. Session cookie (UI) — fall through.
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const email = await verifySessionValue(cookie);
    if (email) return { type: "user", email };
  }

  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
