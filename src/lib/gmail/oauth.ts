/**
 * Google OAuth 2.0 (Workspace) helpers.
 *
 * Flow:
 *   1. /api/workspace/connect generates a state token, builds the
 *      Google authorize URL with `access_type=offline` + `prompt=consent`
 *      (forces a refresh token to be returned), redirects user.
 *   2. Google redirects to /api/workspace/callback?code=...&state=...
 *   3. Callback verifies state cookie, exchanges code for tokens, fetches
 *      the userinfo (email), persists the connection.
 *
 * Scope: gmail.modify gives send + read + label/thread modify in a
 * single consent. Simpler than maintaining separate send-only and
 * read-only scopes and avoids re-consent when we add reply detection.
 */

import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
];

export type OAuthInit = {
  authorizeUrl: string;
  state: string;
};

export function makeAuthorizeUrl(redirectUri: string): OAuthInit {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not set");

  const state = crypto.randomBytes(32).toString("base64url");

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("include_granted_scopes", "true");

  return { authorizeUrl: url.toString(), state };
}

export type ExchangeResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
}): Promise<ExchangeResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} — ${text}`);
  }
  return (await res.json()) as ExchangeResult;
}

export type RefreshResult = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} — ${text}`);
  }
  return (await res.json()) as RefreshResult;
}

export type UserInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo fetch failed: ${res.status}`);
  }
  return (await res.json()) as UserInfo;
}
