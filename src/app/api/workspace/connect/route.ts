/**
 * GET /api/workspace/connect
 *
 * Starts the Google OAuth flow. Sets a short-lived state cookie and
 * redirects to Google's consent screen.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/require";
import { makeAuthorizeUrl } from "@/lib/gmail/oauth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/workspace/callback`;

  const { authorizeUrl, state } = makeAuthorizeUrl(redirectUri);

  const cookieStore = await cookies();
  cookieStore.set("workspace_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
