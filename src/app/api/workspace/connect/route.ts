/**
 * GET /api/workspace/connect?purpose=sending|reading_leads
 *
 * Starts the Google OAuth flow. Sets a short-lived state cookie that
 * also records the intended purpose so the callback knows where to
 * persist the resulting tokens.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/require";
import { makeAuthorizeUrl } from "@/lib/gmail/oauth";
import {
  CONNECTION_PURPOSES,
  type ConnectionPurpose,
} from "@/lib/db/workspace-connections";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const purposeParam = url.searchParams.get("purpose") ?? "sending";
  const purpose: ConnectionPurpose =
    (CONNECTION_PURPOSES as string[]).includes(purposeParam)
      ? (purposeParam as ConnectionPurpose)
      : "sending";

  const redirectUri = `${url.origin}/api/workspace/callback`;

  const { authorizeUrl, state } = makeAuthorizeUrl(redirectUri);

  const cookieStore = await cookies();
  cookieStore.set("workspace_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  // Record the purpose alongside the state so the callback knows which
  // connection slot to write to.
  cookieStore.set("workspace_oauth_purpose", purpose, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
