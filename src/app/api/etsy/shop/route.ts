/**
 * GET /api/etsy/shop
 *
 * Test endpoint — fetches the connected shop's info via the
 * authenticated client. Useful for verifying the connection
 * works end-to-end after OAuth.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getActiveConnection } from "@/lib/db/etsy";
import { etsyFetch } from "@/lib/etsy/client";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const conn = await getActiveConnection();
  if (!conn) {
    return NextResponse.json(
      { ok: false, error: "not-connected" },
      { status: 404 },
    );
  }
  if (!conn.shop_id) {
    return NextResponse.json({ ok: true, connection: conn, shop: null });
  }

  try {
    const shop = await etsyFetch(`/application/shops/${conn.shop_id}`);
    return NextResponse.json({ ok: true, connection: conn, shop });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "etsy-fetch-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
