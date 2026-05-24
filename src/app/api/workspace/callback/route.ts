/**
 * GET /api/workspace/callback
 *
 * Google redirects here after consent. We:
 *   1. Verify the state cookie matches
 *   2. Exchange the code for tokens
 *   3. Fetch userinfo to get the email
 *   4. Persist the connection
 *   5. Redirect back to /settings/workspace
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import {
  CONNECTION_PURPOSES,
  upsertConnection,
  type ConnectionPurpose,
} from "@/lib/db/workspace-connections";
import { exchangeCode, fetchUserInfo } from "@/lib/gmail/oauth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/workspace?error=${encodeURIComponent(error)}`, url.origin),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/workspace?error=missing-params", url.origin),
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("workspace_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL("/settings/workspace?error=state-mismatch", url.origin),
    );
  }
  const purposeCookie = cookieStore.get("workspace_oauth_purpose")?.value;
  const purpose: ConnectionPurpose =
    purposeCookie && (CONNECTION_PURPOSES as string[]).includes(purposeCookie)
      ? (purposeCookie as ConnectionPurpose)
      : "sending";

  const redirectUri = `${url.origin}/api/workspace/callback`;

  try {
    const tokens = await exchangeCode({ code, redirectUri });
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(
          "/settings/workspace?error=no-refresh-token",
          url.origin,
        ),
      );
    }

    const userinfo = await fetchUserInfo(tokens.access_token);

    await upsertConnection({
      email: userinfo.email,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      scopes: tokens.scope.split(" "),
      connected_by: connectedByLabel(auth),
      purpose,
    });
  } catch (err) {
    console.error("[workspace/callback] exchange failed", err);
    return NextResponse.redirect(
      new URL(
        `/settings/workspace?error=${encodeURIComponent((err as Error).message)}`,
        url.origin,
      ),
    );
  }

  cookieStore.delete("workspace_oauth_state");
  cookieStore.delete("workspace_oauth_purpose");
  return NextResponse.redirect(
    new URL(`/settings/workspace?connected=${purpose}`, url.origin),
  );
}

function connectedByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
