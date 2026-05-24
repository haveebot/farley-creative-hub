/**
 * Etsy OAuth 2.0 (Open API v3) helpers.
 *
 * Etsy uses authorization-code with PKCE. Flow:
 *   1. /api/etsy/connect generates a code_verifier + code_challenge,
 *      stores verifier in a short-lived cookie, redirects to Etsy's
 *      authorize URL with the challenge + state.
 *   2. Etsy redirects to /api/etsy/callback?code=...&state=...
 *   3. Callback verifies state, exchanges code for tokens (sending
 *      the original code_verifier), stores tokens, fetches the shop
 *      metadata, persists shop_id + shop_name.
 *
 * Token refresh: when expires_at < now, call /v3/public/oauth/token
 * with grant_type=refresh_token + refresh_token, swap the stored row.
 */

import crypto from "crypto";

const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_SHOPS_URL = "https://openapi.etsy.com/v3/application/users";

// Scopes for Phase 1.
const SCOPES = [
  "shops_r",
  "listings_r",
  "listings_w",
  "transactions_r",
  "email_r",
];

export type OAuthInit = {
  authorizeUrl: string;
  state: string;
  codeVerifier: string;
};

export function makeAuthorizeUrl(redirectUri: string): OAuthInit {
  const clientId = process.env.ETSY_CLIENT_ID;
  if (!clientId) throw new Error("ETSY_CLIENT_ID not set");

  const state = randomString(32);
  const codeVerifier = randomString(64);
  const codeChallenge = base64UrlSha256(codeVerifier);

  const url = new URL(ETSY_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { authorizeUrl: url.toString(), state, codeVerifier };
}

export type ExchangeResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<ExchangeResult> {
  const clientId = process.env.ETSY_CLIENT_ID;
  if (!clientId) throw new Error("ETSY_CLIENT_ID not set");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  });

  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Etsy token exchange failed: ${res.status} — ${text}`);
  }
  return (await res.json()) as ExchangeResult;
}

export async function refreshTokens(refreshToken: string): Promise<ExchangeResult> {
  const clientId = process.env.ETSY_CLIENT_ID;
  if (!clientId) throw new Error("ETSY_CLIENT_ID not set");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Etsy token refresh failed: ${res.status} — ${text}`);
  }
  return (await res.json()) as ExchangeResult;
}

/**
 * Fetch the authenticated user's Etsy user id (which is also their
 * primary shop id under Etsy v3 conventions — usually). Returns user
 * id; caller can then call /users/[user_id]/shops to get shop_name.
 */
export async function fetchAuthenticatedUser(accessToken: string): Promise<{ user_id: number }> {
  const apiKey = process.env.ETSY_CLIENT_ID;
  if (!apiKey) throw new Error("ETSY_CLIENT_ID not set");
  // Token format includes user id as prefix: "userid.actualToken"
  // Per Etsy v3 docs, easiest path: parse the prefix.
  const prefix = accessToken.split(".")[0];
  const user_id = parseInt(prefix, 10);
  if (!Number.isFinite(user_id)) {
    throw new Error("Couldn't parse user id from Etsy access token");
  }
  return { user_id };
}

export async function fetchPrimaryShop(
  accessToken: string,
  userId: number,
): Promise<{ shop_id: number; shop_name: string } | null> {
  const apiKey = process.env.ETSY_CLIENT_ID;
  if (!apiKey) throw new Error("ETSY_CLIENT_ID not set");

  const res = await fetch(`${ETSY_SHOPS_URL}/${userId}/shops`, {
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    // Some accounts return 404 if they don't have a shop yet.
    if (res.status === 404) return null;
    const text = await res.text();
    throw new Error(`Etsy shop fetch failed: ${res.status} — ${text}`);
  }
  const data = await res.json();
  // Etsy returns either a single object or an array depending on count.
  const shop = Array.isArray(data) ? data[0] : data;
  if (!shop?.shop_id) return null;
  return { shop_id: shop.shop_id, shop_name: shop.shop_name ?? "" };
}

// ============ helpers ============

function randomString(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function base64UrlSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}
