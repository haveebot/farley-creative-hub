/**
 * Listings API.
 *
 *   GET  /api/listings              — list
 *   POST /api/listings              — create + auto-draft via Claude
 *                                       body: { working_name, context_notes, asset_id?, brand_kit_id? }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createListing, listListings } from "@/lib/db/listings";
import { getBrandKit, getStudioKit } from "@/lib/db/brand-kits";
import { getAsset } from "@/lib/db/assets";
import { draftListing } from "@/lib/ai/listing-draft";

export const maxDuration = 60;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  return NextResponse.json({ listings: await listListings() });
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

  const workingName =
    typeof body.working_name === "string" ? body.working_name.trim() : "";
  const contextNotes =
    typeof body.context_notes === "string" ? body.context_notes.trim() : "";
  if (!workingName) {
    return NextResponse.json(
      { ok: false, error: "working-name-required" },
      { status: 400 },
    );
  }
  if (!contextNotes) {
    return NextResponse.json(
      {
        ok: false,
        error: "context-notes-required",
        detail:
          "Tell Claude what the listing is for — design type, use case, customization, delivery format, etc. The richer the notes, the better the draft.",
      },
      { status: 400 },
    );
  }

  const assetId = typeof body.asset_id === "number" ? body.asset_id : null;
  const brandKitId =
    typeof body.brand_kit_id === "number" ? body.brand_kit_id : null;

  // Resolve brand kit + optional asset
  const brand =
    (brandKitId ? await getBrandKit(brandKitId) : null) ?? (await getStudioKit());
  const asset = assetId ? await getAsset(assetId) : null;
  const assetSummary = asset
    ? `Filename: ${asset.filename}\nName: ${asset.name}\nType: ${asset.mime_type}\nKind: ${asset.kind}\nSize: ${asset.size_bytes} bytes\nURL: ${asset.url}\n${asset.description ? "Description: " + asset.description : ""}`
    : null;

  const createdBy = auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;

  try {
    const drafted = await draftListing({
      brand,
      context_notes: contextNotes,
      asset_summary: assetSummary,
    });

    const listing = await createListing({
      working_name: workingName,
      asset_id: assetId,
      brand_kit_id: brand.id,
      context_notes: contextNotes,
      title: drafted.title,
      description: drafted.description,
      tags: drafted.tags,
      keywords: drafted.keywords,
      ai_model_used: drafted.model,
      created_by: createdBy,
    });

    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    console.error("[api/listings POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
