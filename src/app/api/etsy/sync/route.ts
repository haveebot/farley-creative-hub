/**
 * POST /api/etsy/sync
 *
 * Pulls all listings from the connected Etsy shop (active + draft + inactive)
 * and upserts them into the Hub.
 *
 * Match strategy: by etsy_listing_id (unique constraint on listings).
 * - If a Hub listing already has this etsy_listing_id: update etsy_state +
 *   etsy_synced_at + etsy_url. We do NOT overwrite Hub-side content fields
 *   (title/description/tags) because the operator may have edited locally
 *   intending to republish. The "ground truth" question is intentionally
 *   left to a future reconciliation UI.
 * - If no Hub listing has this etsy_listing_id: create a new Hub listing
 *   with the Etsy data. status='posted' to reflect it's already on Etsy.
 *
 * Returns counts: { created, updated, total }.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createListing, updateListing } from "@/lib/db/listings";
import { query, queryOne } from "@/lib/db/client";
import { listShopListings, type EtsyListing } from "@/lib/etsy/listings";
import type { Listing, ListingStatus, EtsyState } from "@/lib/listings-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // can be slow for shops with many listings

const ETSY_STATE_TO_HUB_STATUS: Record<EtsyListing["state"], ListingStatus> = {
  active: "posted",
  draft: "approved",
  inactive: "archived",
  expired: "archived",
  sold_out: "posted",
};

export async function POST(_request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let etsyListings: EtsyListing[];
  try {
    const [active, draft, inactive] = await Promise.all([
      listShopListings("active"),
      listShopListings("draft"),
      listShopListings("inactive"),
    ]);
    etsyListings = [...active, ...draft, ...inactive];
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("No connected Etsy shop") ? 503 : 502;
    return NextResponse.json({ ok: false, error: "etsy", message }, { status });
  }

  let created = 0;
  let updated = 0;

  for (const e of etsyListings) {
    const existing = await queryOne<Listing>(
      `SELECT * FROM listings WHERE etsy_listing_id = $1`,
      [e.listing_id],
    );

    if (existing) {
      await updateListing(existing.id, {
        etsy_state: e.state as EtsyState,
        etsy_url: e.url,
        etsy_synced_at: new Date().toISOString(),
      });
      updated++;
    } else {
      const newListing = await createListing({
        working_name: e.title.slice(0, 80),
        title: e.title,
        description: e.description,
        tags: e.tags ?? [],
        keywords: [],
        status: ETSY_STATE_TO_HUB_STATUS[e.state] ?? "draft",
        context_notes: `Imported from Etsy on ${new Date().toISOString().slice(0, 10)}.`,
        created_by: "etsy-sync",
      });
      // Backfill the etsy-specific fields via direct update
      await query(
        `UPDATE listings
            SET etsy_listing_id = $1,
                etsy_state = $2,
                etsy_url = $3,
                etsy_taxonomy_id = $4,
                etsy_shipping_profile_id = $5,
                etsy_who_made = $6,
                etsy_when_made = $7,
                price_cents = $8,
                currency_code = $9,
                quantity = $10,
                etsy_synced_at = NOW(),
                etsy_pushed_at = to_timestamp($11)
          WHERE id = $12`,
        [
          e.listing_id,
          e.state,
          e.url,
          e.taxonomy_id,
          e.shipping_profile_id,
          e.who_made,
          e.when_made,
          Math.round((e.price.amount / e.price.divisor) * 100),
          e.price.currency_code,
          e.quantity,
          e.last_modified_timestamp,
          newListing.id,
        ],
      );
      created++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    total: etsyListings.length,
  });
}
