/**
 *   GET    /api/brand-kits/[id]   — fetch one (studio or client)
 *   PUT    /api/brand-kits/[id]   — update fields
 *   DELETE /api/brand-kits/[id]   — delete (refuses studio-self kit)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { query } from "@/lib/db/client";
import {
  getBrandKit,
  updateBrandKit,
  type BrandKitUpdate,
} from "@/lib/db/brand-kits";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  const kit = await getBrandKit(numId);
  if (!kit) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ kit });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

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

  for (const f of COLOR_FIELDS) {
    const v = updates[f];
    if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
      return NextResponse.json(
        { ok: false, error: "invalid-color", message: `${f.replace(/_/g, " ")} must be a hex value or empty.` },
        { status: 400 },
      );
    }
  }

  try {
    const kit = await updateBrandKit(numId, updates);
    return NextResponse.json({ ok: true, kit });
  } catch (err) {
    console.error("[api/brand-kits PUT] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  const kit = await getBrandKit(numId);
  if (!kit) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (kit.is_studio_self) {
    return NextResponse.json(
      { ok: false, error: "cannot-delete-studio", message: "The studio brand kit can't be deleted." },
      { status: 400 },
    );
  }

  await query(`DELETE FROM brand_kits WHERE id = $1`, [numId]);
  return NextResponse.json({ ok: true });
}
