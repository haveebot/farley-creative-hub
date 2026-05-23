/**
 * Middleware — gate every route behind a valid session cookie except:
 *   - /login + /setup (the auth surfaces themselves)
 *   - /api/auth/* (login, signup, logout)
 *   - Next.js internals (/_next, /favicon.ico, etc.)
 *
 * Session validation here is HMAC-only (no DB), so it runs in the edge
 * runtime without dependencies. Imports session-tokens.ts (not
 * session.ts) to avoid pulling in server-only `next/headers` cookie
 * APIs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/auth/session-tokens";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const email = cookie ? verifySessionValue(cookie) : null;

  if (!email) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
