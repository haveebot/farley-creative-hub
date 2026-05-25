/**
 * Middleware — gates page routes behind a valid session cookie.
 *
 * API routes are NOT gated here — they call `requireAuth()` themselves
 * so they can accept either cookie OR bearer-token (agent) auth. If we
 * redirected unauthenticated API calls to /login (the page route flow),
 * agents would get HTML instead of a clean 401 JSON response.
 *
 * Public page routes: /login, /signup
 * Public API root: /api/auth/* (login, signup, logout)
 * All other /api/*: pass through; route handlers enforce auth
 * All other pages: must have a valid session cookie
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/auth/session-tokens";

const PUBLIC_PAGE_PATHS = ["/login", "/signup", "/privacy", "/icon", "/apple-icon"];

const DEMO_WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Endpoints that should remain functional even in demo mode (read APIs
// for the public demo, auth endpoints in case someone logs in, the
// cron endpoints which no-op via the demo-mode env check inside them).
const DEMO_ALLOWED_PATH_PREFIXES = [
  "/api/auth/",
  "/api/cron/",
  "/api/daily-briefing/", // read-cached or regen via Claude (Hub home auto-gen)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const demoMode = process.env.DEMO_MODE === "true";

  // ----- Demo mode: bypass auth, block writes -----
  if (demoMode) {
    // Block mutating API calls (except allowlist) — return read-only JSON.
    if (
      pathname.startsWith("/api/") &&
      DEMO_WRITE_METHODS.has(request.method) &&
      !DEMO_ALLOWED_PATH_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error: "demo-read-only",
          message:
            "This is a demo Hub — changes don't persist. Everything you see is realistic sample content.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // No auth required in demo mode — pass through.
    return NextResponse.next();
  }

  // ----- Normal mode -----

  // All /api/* routes self-enforce via requireAuth().
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Public page routes.
  if (
    PUBLIC_PAGE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return NextResponse.next();
  }

  // Everything else: require session cookie.
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const email = cookie ? await verifySessionValue(cookie) : null;

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
