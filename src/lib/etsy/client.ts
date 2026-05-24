/**
 * Authenticated Etsy API client. Auto-refreshes tokens when expired.
 *
 * Usage:
 *   const data = await etsyFetch("/application/shops/{shop_id}");
 */

import { getActiveConnection, upsertConnection } from "@/lib/db/etsy";
import { refreshTokens } from "./oauth";

const ETSY_API_BASE = "https://openapi.etsy.com/v3";
const REFRESH_WINDOW_MS = 5 * 60 * 1000; // refresh if expires within 5 min

async function getValidAccessToken(): Promise<string> {
  const conn = await getActiveConnection();
  if (!conn) {
    throw new Error("No Etsy connection — operator needs to connect via /settings/etsy");
  }
  const expiresMs = new Date(conn.expires_at).getTime();
  if (expiresMs - Date.now() > REFRESH_WINDOW_MS) {
    return conn.access_token;
  }
  // Refresh.
  const fresh = await refreshTokens(conn.refresh_token);
  await upsertConnection({
    tokens: {
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_in: fresh.expires_in,
      scopes: conn.scopes,
    },
    shop_id: conn.shop_id ?? null,
    shop_name: conn.shop_name ?? null,
    connected_by: conn.connected_by,
  });
  return fresh.access_token;
}

export async function etsyFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiKey = process.env.ETSY_CLIENT_ID;
  if (!apiKey) throw new Error("ETSY_CLIENT_ID not set");

  const accessToken = await getValidAccessToken();
  const url = path.startsWith("http") ? path : `${ETSY_API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "x-api-key": apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Etsy API ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
