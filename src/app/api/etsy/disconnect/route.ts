/**
 * POST /api/etsy/disconnect
 *
 * Clears the stored Etsy connection. Doesn't revoke tokens on Etsy's
 * side (Etsy v3 has no public revoke endpoint as of writing) — the
 * tokens just stop being used by this Hub. To fully revoke, she'd
 * need to manage from her Etsy account settings.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { disconnectAll } from "@/lib/db/etsy";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  await disconnectAll();

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/settings/etsy", url.origin), { status: 303 });
}
