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
};
