/**
 * Listings — shared types (no DB imports; client-safe).
 */

export type ListingStatus = "draft" | "approved" | "posted" | "archived";

export const LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "approved",
  "posted",
  "archived",
];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  posted: "Posted to Etsy",
  archived: "Archived",
};

export type EtsyState = "draft" | "active" | "inactive" | "expired" | "sold_out" | null;

export const ETSY_WHO_MADE = ["i_did", "someone_else", "collective"] as const;
export type EtsyWhoMade = (typeof ETSY_WHO_MADE)[number];

export const ETSY_WHEN_MADE = [
  "made_to_order",
  "2020_2025",
  "2010_2019",
  "2006_2009",
  "before_2006",
  "2000_2005",
  "1990s",
  "1980s",
  "1970s",
  "1960s",
  "1950s",
  "1940s",
  "1930s",
  "1920s",
  "1910s",
  "1900s",
  "1800s",
  "1700s",
  "before_1700",
] as const;
export type EtsyWhenMade = (typeof ETSY_WHEN_MADE)[number];

export type Listing = {
  id: number;
  working_name: string;
  asset_id: number | null;
  brand_kit_id: number | null;
  context_notes: string;
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  status: ListingStatus;
  ai_model_used: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  posted_at: string | null;

  // Etsy-publishing fields
  price_cents: number | null;
  currency_code: string;
  quantity: number;
  etsy_listing_id: number | null;
  etsy_state: EtsyState;
  etsy_taxonomy_id: number | null;
  etsy_shipping_profile_id: number | null;
  etsy_who_made: EtsyWhoMade;
  etsy_when_made: EtsyWhenMade;
  etsy_pushed_at: string | null;
  etsy_synced_at: string | null;
  etsy_url: string | null;
};

export type ListingImage = {
  id: number;
  listing_id: number;
  asset_id: number;
  position: number;
  etsy_image_id: number | null;
  uploaded_at: string | null;
  created_at: string;
};

/**
 * Fields that must be set before a listing can be pushed to Etsy.
 * Returns an array of human-readable problems (empty = ready to push).
 */
export function validateForEtsyPush(listing: Listing, imageCount: number): string[] {
  const problems: string[] = [];
  if (!listing.title.trim()) problems.push("Title is empty");
  if (listing.title.length > 140) problems.push("Title exceeds 140 chars");
  if (!listing.description.trim()) problems.push("Description is empty");
  if (listing.tags.length > 13) problems.push("More than 13 tags (Etsy max)");
  if (listing.price_cents == null || listing.price_cents <= 0) problems.push("Price not set");
  if (listing.quantity < 1) problems.push("Quantity must be at least 1");
  if (!listing.etsy_taxonomy_id) problems.push("Etsy category (taxonomy) not picked");
  if (!listing.etsy_shipping_profile_id) problems.push("Shipping profile not picked");
  if (imageCount === 0) problems.push("At least one image required");
  return problems;
}
