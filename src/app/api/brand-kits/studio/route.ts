/**
 * Studio brand kit API.
 *
 *   GET /api/brand-kits/studio   — return Farley Girls Creative's kit
 *   PUT /api/brand-kits/studio   — update the studio kit
 *
 * (Client kits will live at /api/brand-kits/[id] when Phase 2 lands.)
 */

import { NextResponse } from "next/server";
import { getStudioKit, updateBrandKit, type BrandKitUpdate } from "@/lib/db/brand-kits";

const HEX_COLOR_OR_EMPTY = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

const STRING_FIELDS: Array<keyof BrandKitUpdate> = [
  "name",
  "bio",
  "primary_color",
  "secondary_color",
  "accent_color",
  "voice_notes",
  "brand_book_notes",
  "etsy_shop_url",
  "website_url",
  "instagram_url",
  "pinterest_url",
];

const COLOR_FIELDS: Array<keyof BrandKitUpdate> = [
  "primary_color",
  "secondary_color",
  "accent_color",
];

export async function GET() {
  const kit = await getStudioKit();
  return NextResponse.json({ kit });
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: BrandKitUpdate = {};
  for (const f of STRING_FIELDS) {
    const v = body[f];
    if (typeof v === "string") {
      updates[f] = v.trim() as never;
    }
  }

  // Validate color fields (empty allowed; hex required if present).
  for (const f of COLOR_FIELDS) {
    const v = updates[f];
    if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
      return NextResponse.json(
        { ok: false, error: "invalid-color", message: `${f.replace(/_/g, " ")} must be a hex value like #c97d5d, or empty.` },
        { status: 400 },
      );
    }
  }

  try {
    const kit = await getStudioKit();
    const updated = await updateBrandKit(kit.id, updates);
    return NextResponse.json({ ok: true, kit: updated });
  } catch (err) {
    console.error("[api/brand-kits/studio PUT] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}
