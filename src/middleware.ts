/**
 * Middleware — gate every route behind a valid session cookie except:
 *   - /login (the login page itself)
 *   - /api/auth/* (request, verify, logout)
 *   - Next.js internals (/_next, /favicon.ico, etc.)
 *
 * Session validation here is HMAC-only (no DB), so it runs in the edge
 * runtime without dependencies.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without checking session.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Check session cookie.
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
    // Apply to everything except Next.js internals + static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
