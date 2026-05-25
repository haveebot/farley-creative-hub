/**
 * GET  /api/listings/[id]/images     — list attached images, in order
 * POST /api/listings/[id]/images     — attach an asset (body: { asset_id })
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getListing } from "@/lib/db/listings";
import { getAsset } from "@/lib/db/assets";
import {
  attachImage,
  listImagesForListing,
} from "@/lib/db/listing-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const images = await listImagesForListing(Number(id));
  return NextResponse.json({ ok: true, images });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const listingId = Number(id);

  let body: { asset_id?: number };
  try {
    body = (await request.json()) as { asset_id?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }
  if (typeof body.asset_id !== "number") {
    return NextResponse.json({ ok: false, error: "asset_id-required" }, { status: 400 });
  }

  const [listing, asset] = await Promise.all([
    getListing(listingId),
    getAsset(body.asset_id),
  ]);
  if (!listing) {
    return NextResponse.json({ ok: false, error: "listing-not-found" }, { status: 404 });
  }
  if (!asset) {
    return NextResponse.json({ ok: false, error: "asset-not-found" }, { status: 404 });
  }
  if (!asset.mime_type.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "asset-not-an-image", message: `${asset.mime_type} can't be pushed to Etsy as a listing image.` },
      { status: 400 },
    );
  }

  const existing = await listImagesForListing(listingId);
  if (existing.length >= 10) {
    return NextResponse.json(
      { ok: false, error: "max-images", message: "Etsy allows max 10 images per listing." },
      { status: 400 },
    );
  }

  const image = await attachImage(listingId, body.asset_id, existing.length);
  return NextResponse.json({ ok: true, image });
}
