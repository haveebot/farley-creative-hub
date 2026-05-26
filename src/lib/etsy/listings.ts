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

export type UpdateListingInput = {
  title?: string;
  description?: string;
  tags?: string[];
  materials?: string[];
  price?: number;
  quantity?: number;
  state?: "active" | "inactive" | "draft";
  should_auto_renew?: boolean;
};

/**
 * Update an existing listing. Highest-leverage field for organic Etsy
 * traffic is `tags` (max 13). state="active" republishes a draft;
 * state="inactive" hides a listing without deleting it.
 *
 * Etsy's update endpoint is `PATCH /v3/application/shops/{shop_id}/listings/{listing_id}`
 * and accepts application/x-www-form-urlencoded. Arrays serialize as
 * comma-joined strings (tags, materials).
 */
export async function updateListing(
  listingId: number,
  input: UpdateListingInput,
): Promise<EtsyListing> {
  const shopId = await requireShopId();
  const form = new URLSearchParams();
  if (input.title !== undefined) form.set("title", input.title);
  if (input.description !== undefined) form.set("description", input.description);
  if (input.tags !== undefined) form.set("tags", input.tags.slice(0, 13).join(","));
  if (input.materials !== undefined) form.set("materials", input.materials.slice(0, 13).join(","));
  if (input.price !== undefined) form.set("price", input.price.toFixed(2));
  if (input.quantity !== undefined) form.set("quantity", String(input.quantity));
  if (input.state !== undefined) form.set("state", input.state);
  if (input.should_auto_renew !== undefined) {
    form.set("should_auto_renew", input.should_auto_renew ? "true" : "false");
  }
  if (form.toString() === "") {
    throw new Error("updateListing called with no fields to update");
  }
  return etsyFetch<EtsyListing>(
    `/application/shops/${shopId}/listings/${listingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
  );
}
