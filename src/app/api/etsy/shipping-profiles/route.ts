import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { listShippingProfiles } from "@/lib/etsy/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  try {
    const profiles = await listShippingProfiles();
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("No connected Etsy shop") ? 503 : 502;
    return NextResponse.json({ ok: false, error: "etsy", message }, { status });
  }
}
