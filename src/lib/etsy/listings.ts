/**
 * Etsy listing operations: create draft, upload image, list shop listings.
 *
 * All ops resolve the connected shop_id internally — callers don't need
 * to thread it.
 */

import { etsyFetch } from "./client";
import { getActiveConnection } from "@/lib/db/etsy";

export type EtsyListingState =
  | "active"
  | "inactive"
  | "draft"
  | "expired"
  | "sold_out";

export type EtsyListing = {
  listing_id: number;
  shop_id: number;
  title: string;
  description: string;
  state: EtsyListingState;
  quantity: number;
  price: { amount: number; divisor: number; currency_code: string };
  tags: string[];
  taxonomy_id: number;
  shipping_profile_id: number;
  who_made: string;
  when_made: string;
  url: string;
  num_favorers: number;
  views: number;
  last_modified_timestamp: number;
};

export type CreateListingInput = {
  quantity: number;
  title: string;
  description: string;
  price: number; // dollars, e.g. 24.99
  who_made: string;
  when_made: string;
  taxonomy_id: number;
  shipping_profile_id: number;
  return_policy_id?: number;
  tags?: string[];
  state?: "draft" | "active"; // default 'draft' for safety
};

async function requireShopId(): Promise<number> {
  const conn = await getActiveConnection();
  if (!conn?.shop_id) {
    throw new Error("No connected Etsy shop. Connect at /settings/etsy.");
  }
  return conn.shop_id;
}

/**
 * Create a DRAFT listing on Etsy. Returns the new listing_id.
 *
 * Etsy's createDraftListing endpoint is application/x-www-form-urlencoded.
 * Tags must be comma-separated; price is a decimal number.
 */
export async function createDraftListing(input: CreateListingInput): Promise<EtsyListing> {
  const shopId = await requireShopId();

  const form = new URLSearchParams();
  form.set("quantity", String(input.quantity));
  form.set("title", input.title);
  form.set("description", input.description);
  form.set("price", input.price.toFixed(2));
  form.set("who_made", input.who_made);
  form.set("when_made", input.when_made);
  form.set("taxonomy_id", String(input.taxonomy_id));
  form.set("shipping_profile_id", String(input.shipping_profile_id));
  if (input.return_policy_id) {
    form.set("return_policy_id", String(input.return_policy_id));
  }
  if (input.tags?.length) {
    form.set("tags", input.tags.slice(0, 13).join(","));
  }
  form.set("state", input.state ?? "draft");

  return etsyFetch<EtsyListing>(`/application/shops/${shopId}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

/**
 * Upload one image to an existing listing. Etsy returns the listing_image_id
 * which we persist on listing_images.etsy_image_id.
 *
 * imageBytes must be the raw image bytes (JPEG/PNG). rank controls display
 * order on Etsy (1 = primary).
 */
export async function uploadListingImage(
  listingId: number,
  imageBytes: Buffer,
  filename: string,
  rank: number,
): Promise<{ listing_image_id: number; url_fullxfull: string }> {
  const shopId = await requireShopId();

  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBytes)]);
  form.append("image", blob, filename);
  form.append("rank", String(rank));

  return etsyFetch<{ listing_image_id: number; url_fullxfull: string }>(
    `/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      body: form,
      // Don't set Content-Type — fetch sets multipart boundary automatically.
    },
  );
}

/**
 * List the shop's listings, optionally filtered by state. Paginated 100/page.
 * Returns the full set across pages.
 */
export async function listShopListings(
  state?: EtsyListingState,
  maxPages = 10,
): Promise<EtsyListing[]> {
  const shopId = await requireShopId();
  const all: EtsyListing[] = [];
  const limit = 100;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (state) params.set("state", state);
    const res = await etsyFetch<{ count: number; results: EtsyListing[] }>(
      `/application/shops/${shopId}/listings?${params.toString()}`,
    );
    all.push(...res.results);
    if (res.results.length < limit) break;
  }
  return all;
}

export async function deleteListing(listingId: number): Promise<void> {
  await etsyFetch(`/application/listings/${listingId}`, { method: "DELETE" });
}
