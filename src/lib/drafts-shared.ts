/**
 * Client-safe draft types + helpers. No DB imports — safe to use from
 * client components.
 */

export type DraftKind =
  | "listing"
  | "pin"
  | "customer_reply"
  | "social_post"
  | "blog"
  | "email"
  | "general";

export type DraftStatus = "draft" | "approved" | "published" | "archived";

export const DRAFT_KINDS: DraftKind[] = [
  "listing",
  "pin",
  "customer_reply",
  "social_post",
  "blog",
  "email",
  "general",
];

export const DRAFT_STATUSES: DraftStatus[] = [
  "draft",
  "approved",
  "published",
  "archived",
];

export const KIND_LABELS: Record<DraftKind, string> = {
  listing: "Etsy listing",
  pin: "Pinterest pin",
  customer_reply: "Customer reply",
  social_post: "Social post",
  blog: "Blog",
  email: "Email",
  general: "General",
};

export const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export type Draft = {
  id: number;
  title: string;
  kind: DraftKind;
  status: DraftStatus;
  prompt: string;
  content: string;
  brand_kit_id: number | null;
  model_used: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};
