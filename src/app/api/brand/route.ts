/**
 * Brand identity API.
 *
 *   GET  /api/brand  — return the current brand record
 *   PUT  /api/brand  — update brand fields (operator-only via middleware)
 *
 * Middleware already gates this behind a valid session, so no extra
 * auth check needed here. Validation: trim strings, reject obviously
 * bad values (color hex, URL shape).
 */

import { NextResponse } from "next/server";
import { getBrand, updateBrand, type BrandUpdate } from "@/lib/db/brand";

export async function GET() {
  const brand = await getBrand();
  return NextResponse.json({ brand });
}

const STRING_FIELDS: Array<keyof BrandUpdate> = [
  "studio_name",
  "hub_label",
  "bio",
  "primary_color",
  "voice_notes",
  "etsy_shop_url",
  "website_url",
  "instagram_url",
  "pinterest_url",
];

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: BrandUpdate = {};
  for (const f of STRING_FIELDS) {
    const v = body[f];
    if (typeof v === "string") {
      updates[f] = v.trim();
    }
  }

  // Validate hex color if provided.
  if (updates.primary_color && !HEX_COLOR.test(updates.primary_color)) {
    return NextResponse.json(
      { ok: false, error: "invalid-color", message: "Primary color must be a hex value like #c97d5d." },
      { status: 400 },
    );
  }

  try {
    const brand = await updateBrand(updates);
    return NextResponse.json({ ok: true, brand });
  } catch (err) {
    console.error("[api/brand PUT] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}
