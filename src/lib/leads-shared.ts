/**
 * Client-safe lead types + constants. No DB imports.
 */

export type LeadSourceType =
  | "job_posting"
  | "rfp"
  | "article"
  | "social_post"
  | "referral_mention"
  | "cold_list"
  | "other";

export const LEAD_SOURCE_TYPES: LeadSourceType[] = [
  "job_posting",
  "rfp",
  "article",
  "social_post",
  "referral_mention",
  "cold_list",
  "other",
];

export const LEAD_SOURCE_LABELS: Record<LeadSourceType, string> = {
  job_posting: "Job posting",
  rfp: "RFP",
  article: "Article / news",
  social_post: "Social post",
  referral_mention: "Referral mention",
  cold_list: "Cold list",
  other: "Other",
};

export type LeadStatus = "new" | "reviewing" | "qualified" | "converted" | "dismissed";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "reviewing",
  "qualified",
  "converted",
  "dismissed",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  qualified: "Qualified",
  converted: "Converted",
  dismissed: "Dismissed",
};

export type Lead = {
  id: number;
  source_type: LeadSourceType;
  source_url: string | null;
  source_title: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  size: string | null;
  service_signal: string[];
  raw_content: string;
  notes: string;
  status: LeadStatus;
  converted_to_prospect_id: number | null;
  first_touch_drafted_at: Date | null;
  first_touch_gmail_draft_id: string | null;
  first_touch_subject: string | null;
  first_touch_jd_source: string | null;
  found_by: string;
  created_at: Date;
  updated_at: Date;
};
