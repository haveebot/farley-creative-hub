/**
 * POST /api/etsy/admin/refresh-shop
 *
 * Operator-only utility (CRON_SECRET bearer). Re-fetches user + shop
 * metadata for the current Etsy connection and backfills shop_id /
 * shop_name / scopes. Useful when the OAuth callback's best-effort
 * shop fetch silently failed and we need to reconcile after.
 *
 * Idempotent + safe to call repeatedly.
 */

import { NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/db/agent-tokens";
import { getActiveConnection, upsertConnection } from "@/lib/db/etsy";
import { fetchAuthenticatedUser, fetchPrimaryShop } from "@/lib/etsy/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/);
  const token = match?.[1];

  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Accept either CRON_SECRET or any active agent_token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) {
    // ok
  } else {
    const record = await verifyAgentToken(token);
    if (!record) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const conn = await getActiveConnection();
  if (!conn) {
    return NextResponse.json({ ok: false, error: "no-connection" }, { status: 404 });
  }

  try {
    const userInfo = await fetchAuthenticatedUser(conn.access_token);
    const shop = await fetchPrimaryShop(conn.access_token, userInfo.user_id);

    await upsertConnection({
      tokens: {
        access_token: conn.access_token,
        refresh_token: conn.refresh_token,
        // Re-derive expires_in from stored expires_at
        expires_in: Math.max(
          0,
          Math.floor(
            (new Date(conn.expires_at).getTime() - Date.now()) / 1000,
          ),
        ),
        scopes: conn.scopes,
      },
      shop_id: shop?.shop_id ?? null,
      shop_name: shop?.shop_name ?? null,
      connected_by: conn.connected_by,
    });

    return NextResponse.json({
      ok: true,
      user_id: userInfo.user_id,
      shop_id: shop?.shop_id ?? null,
      shop_name: shop?.shop_name ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "etsy-fetch-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
