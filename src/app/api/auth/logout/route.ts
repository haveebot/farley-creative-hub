/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. Returns to /login.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/login", url.origin), { status: 303 });
}

export async function GET(request: Request) {
  // Convenience GET so a direct link works too.
  return POST(request);
}
