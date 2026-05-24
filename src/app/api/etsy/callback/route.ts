/**
 * GET /api/etsy/callback
 *
 * Etsy redirects here after authorization. We:
 *   1. Verify the state cookie matches what Etsy sent
 *   2. Exchange the code (+ PKCE verifier from cookie) for tokens
 *   3. Fetch the user's primary shop
 *   4. Persist the connection
 *   5. Redirect back to /settings/etsy
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { upsertConnection } from "@/lib/db/etsy";
import {
  exchangeCode,
  fetchAuthenticatedUser,
  fetchPrimaryShop,
} from "@/lib/etsy/oauth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/etsy?error=${encodeURIComponent(error)}`, url.origin),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/etsy?error=missing-params", url.origin),
    );
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("etsy_oauth_state")?.value;
  const verifierCookie = cookieStore.get("etsy_oauth_verifier")?.value;

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL("/settings/etsy?error=state-mismatch", url.origin),
    );
  }
  if (!verifierCookie) {
    return NextResponse.redirect(
      new URL("/settings/etsy?error=verifier-missing", url.origin),
    );
  }

  const redirectUri = `${url.origin}/api/etsy/callback`;

  try {
    const tokens = await exchangeCode({
      code,
      codeVerifier: verifierCookie,
      redirectUri,
    });

    // Best-effort shop metadata; failure here shouldn't break the connection.
    let shop_id: number | null = null;
    let shop_name: string | null = null;
    try {
      const { user_id } = await fetchAuthenticatedUser(tokens.access_token);
      const shop = await fetchPrimaryShop(tokens.access_token, user_id);
      if (shop) {
        shop_id = shop.shop_id;
        shop_name = shop.shop_name;
      }
    } catch (err) {
      console.warn("[etsy/callback] shop metadata fetch failed", err);
    }

    await upsertConnection({
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      },
      shop_id,
      shop_name,
      connected_by: connectedByLabel(auth),
    });
  } catch (err) {
    console.error("[etsy/callback] exchange failed", err);
    return NextResponse.redirect(
      new URL(
        `/settings/etsy?error=${encodeURIComponent((err as Error).message)}`,
        url.origin,
      ),
    );
  }

  // Clear the OAuth cookies.
  cookieStore.delete("etsy_oauth_state");
  cookieStore.delete("etsy_oauth_verifier");

  return NextResponse.redirect(new URL("/settings/etsy?connected=1", url.origin));
}

function connectedByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
