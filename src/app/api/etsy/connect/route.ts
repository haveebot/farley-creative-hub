/**
 * GET /api/etsy/connect
 *
 * Initiates the Etsy OAuth flow. Generates state + PKCE verifier,
 * stores them in short-lived cookies, redirects to Etsy's authorize
 * page.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/require";
import { makeAuthorizeUrl } from "@/lib/etsy/oauth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600, // 10 min — auth flow should complete quickly
  path: "/",
};

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/etsy/callback`;

  let init;
  try {
    init = makeAuthorizeUrl(redirectUri);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "etsy-not-configured", message: (err as Error).message },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("etsy_oauth_state", init.state, COOKIE_OPTS);
  cookieStore.set("etsy_oauth_verifier", init.codeVerifier, COOKIE_OPTS);

  return NextResponse.redirect(init.authorizeUrl);
}
