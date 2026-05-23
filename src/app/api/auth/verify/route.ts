/**
 * GET /api/auth/verify?t=<token>
 *
 * Verifies the magic-link token, sets the session cookie, and
 * redirects to `/` on success. On failure, redirects to /login with
 * an error flag.
 */

import { NextResponse } from "next/server";
import { isAllowedOperator } from "@/lib/auth/allowlist";
import { setSessionCookie, verifyMagicLinkToken } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", url.origin));
  }

  const email = verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", url.origin));
  }

  // Belt-and-suspenders: re-check allowlist at verify time in case it
  // changed between request and click.
  if (!isAllowedOperator(email)) {
    return NextResponse.redirect(new URL("/login?error=not-authorized", url.origin));
  }

  await setSessionCookie(email);
  return NextResponse.redirect(new URL("/", url.origin));
}
