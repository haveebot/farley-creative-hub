/**
 * Brand kits — list + create.
 *
 *   GET  /api/brand-kits   — list all (studio first, then clients alphabetical)
 *   POST /api/brand-kits   — create a CLIENT kit (is_studio_self enforced false)
 *
 * The studio's own kit is created on first read of /api/brand-kits/studio;
 * it can't be created or deleted via this endpoint.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createClientKit, listBrandKits } from "@/lib/db/brand-kits";

const HEX_COLOR_OR_EMPTY = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const kits = await listBrandKits();
  return NextResponse.json({ kits });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "name-required" }, { status: 400 });
  }

  const input: Record<string, string> = { name };
  for (const f of [
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
  ]) {
    const v = body[f];
    if (typeof v === "string") input[f] = v.trim();
  }

  for (const f of ["primary_color", "secondary_color", "accent_color"]) {
    const v = input[f];
    if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
      return NextResponse.json(
        { ok: false, error: "invalid-color", message: `${f.replace(/_/g, " ")} must be a hex value or empty.` },
        { status: 400 },
      );
    }
  }

  try {
    const kit = await createClientKit(input as never);
    return NextResponse.json({ ok: true, kit });
  } catch (err) {
    console.error("[api/brand-kits POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
