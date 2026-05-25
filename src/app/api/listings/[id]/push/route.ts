/**
 * POST /api/listings/[id]/push
 *
 * Creates a DRAFT listing on Etsy from the Hub listing's data, then uploads
 * any attached Hub images to that draft listing. Operator reviews + publishes
 * on Etsy from the draft.
 *
 * Idempotency: if the listing already has etsy_listing_id, we DO NOT create
 * a duplicate. Instead we re-upload any images not yet pushed (etsy_image_id
 * IS NULL). To force a fresh push (e.g., after deleting on Etsy), clear
 * etsy_listing_id first via a separate "unlink" action.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getListing, updateListing } from "@/lib/db/listings";
import { getAsset } from "@/lib/db/assets";
import {
  listImagesForListing,
  markImageUploaded,
} from "@/lib/db/listing-images";
import {
  createDraftListing,
  uploadListingImage,
} from "@/lib/etsy/listings";
import { validateForEtsyPush } from "@/lib/listings-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // image uploads can be slow

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const listingId = Number(id);

  const listing = await getListing(listingId);
  if (!listing) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const images = await listImagesForListing(listingId);
  const problems = validateForEtsyPush(listing, images.length);
  if (problems.length > 0) {
    return NextResponse.json(
      { ok: false, error: "not-ready", problems },
      { status: 422 },
    );
  }

  let etsyListingId = listing.etsy_listing_id;
  let etsyUrl = listing.etsy_url;

  // 1. Create the draft on Etsy (only if not already pushed)
  if (!etsyListingId) {
    try {
      const created = await createDraftListing({
        quantity: listing.quantity,
        title: listing.title,
        description: listing.description,
        price: listing.price_cents! / 100,
        who_made: listing.etsy_who_made,
        when_made: listing.etsy_when_made,
        taxonomy_id: listing.etsy_taxonomy_id!,
        shipping_profile_id: listing.etsy_shipping_profile_id!,
        tags: listing.tags,
        state: "draft",
      });
      etsyListingId = created.listing_id;
      etsyUrl = created.url;
      await updateListing(listingId, {
        etsy_listing_id: etsyListingId,
        etsy_state: "draft",
        etsy_url: etsyUrl,
        etsy_pushed_at: new Date().toISOString(),
        status: "posted",
      });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[push ${listingId}] createDraftListing failed`, err);
      return NextResponse.json(
        { ok: false, error: "etsy-create-failed", message },
        { status: 502 },
      );
    }
  }

  // 2. Upload any images not yet pushed
  const uploadResults: Array<{ image_id: number; ok: boolean; error?: string }> = [];
  for (const img of images) {
    if (img.etsy_image_id) {
      uploadResults.push({ image_id: img.id, ok: true });
      continue;
    }
    const asset = await getAsset(img.asset_id);
    if (!asset) {
      uploadResults.push({ image_id: img.id, ok: false, error: "asset-missing" });
      continue;
    }
    try {
      const bytes = await fetchAssetBytes(asset.url);
      const result = await uploadListingImage(
        etsyListingId!,
        bytes,
        asset.name,
        img.position + 1, // Etsy rank is 1-indexed
      );
      await markImageUploaded(img.id, result.listing_image_id);
      uploadResults.push({ image_id: img.id, ok: true });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[push ${listingId}] image upload failed`, err);
      uploadResults.push({ image_id: img.id, ok: false, error: message });
    }
  }

  const updated = await getListing(listingId);
  return NextResponse.json({
    ok: true,
    listing: updated,
    etsy_listing_id: etsyListingId,
    etsy_url: etsyUrl,
    images_uploaded: uploadResults.filter((r) => r.ok).length,
    images_failed: uploadResults.filter((r) => !r.ok).length,
    upload_results: uploadResults,
  });
}

async function fetchAssetBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch asset bytes (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
