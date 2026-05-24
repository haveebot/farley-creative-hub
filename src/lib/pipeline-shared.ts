/**
 * Client-safe pipeline types + constants. No DB imports.
 */

export type ProspectStatus =
  | "lead"
  | "contacted"
  | "discovery"
  | "proposal"
  | "negotiating"
  | "signed"
  | "passed"
  | "dormant";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "lead",
  "contacted",
  "discovery",
  "proposal",
  "negotiating",
  "signed",
  "passed",
  "dormant",
];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  lead: "Lead",
  contacted: "Contacted",
  discovery: "Discovery",
  proposal: "Proposal sent",
  negotiating: "Negotiating",
  signed: "Signed",
  passed: "Passed",
  dormant: "Dormant",
};

export type ProspectSize = "solo" | "small" | "medium" | "larger";

export const PROSPECT_SIZES: ProspectSize[] = ["solo", "small", "medium", "larger"];

export const SIZE_LABELS: Record<ProspectSize, string> = {
  solo: "Solo (1)",
  small: "Small (2–10)",
  medium: "Medium (11–50)",
  larger: "Larger (50+)",
};

export type ProspectIndustry =
  | "food_beverage"
  | "retail"
  | "professional_services"
  | "health_wellness"
  | "arts_creative"
  | "technology"
  | "hospitality"
  | "nonprofit"
  | "other";

export const PROSPECT_INDUSTRIES: ProspectIndustry[] = [
  "food_beverage",
  "retail",
  "professional_services",
  "health_wellness",
  "arts_creative",
  "technology",
  "hospitality",
  "nonprofit",
  "other",
];

export const INDUSTRY_LABELS: Record<ProspectIndustry, string> = {
  food_beverage: "Food & beverage",
  retail: "Retail",
  professional_services: "Professional services",
  health_wellness: "Health & wellness",
  arts_creative: "Arts & creative",
  technology: "Technology",
  hospitality: "Hospitality",
  nonprofit: "Nonprofit",
  other: "Other",
};

export type ServiceInterest =
  | "brand_identity"
  | "web_design"
  | "marketing"
  | "strategy"
  | "packaging"
  | "social_media"
  | "content"
  | "other";

export const SERVICE_INTERESTS: ServiceInterest[] = [
  "brand_identity",
  "web_design",
  "marketing",
  "strategy",
  "packaging",
  "social_media",
  "content",
  "other",
];

export const SERVICE_LABELS: Record<ServiceInterest, string> = {
  brand_identity: "Brand identity",
  web_design: "Web design",
  marketing: "Marketing",
  strategy: "Strategy",
  packaging: "Packaging",
  social_media: "Social media",
  content: "Content",
  other: "Other",
};

export type ProspectSource =
  | "referral"
  | "cold_outreach"
  | "inbound"
  | "event"
  | "repeat_client"
  | "other";

export const PROSPECT_SOURCES: ProspectSource[] = [
  "referral",
  "cold_outreach",
  "inbound",
  "event",
  "repeat_client",
  "other",
];

export const SOURCE_LABELS: Record<ProspectSource, string> = {
  referral: "Referral",
  cold_outreach: "Cold outreach",
  inbound: "Inbound",
  event: "Event",
  repeat_client: "Repeat client",
  other: "Other",
};

export type ActivityKind =
  | "email_sent"
  | "email_drafted"
  | "call"
  | "meeting"
  | "proposal_sent"
  | "note"
  | "status_change";

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  email_sent: "Email sent",
  email_drafted: "Email drafted (awaiting review)",
  call: "Call",
  meeting: "Meeting",
  proposal_sent: "Proposal sent",
  note: "Note",
  status_change: "Status change",
};

export type ContactRole =
  | "owner"
  | "marketing_lead"
  | "designer"
  | "decision_maker"
  | "other";

export const CONTACT_ROLES: ContactRole[] = [
  "owner",
  "marketing_lead",
  "designer",
  "decision_maker",
  "other",
];

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  owner: "Owner",
  marketing_lead: "Marketing lead",
  designer: "Designer",
  decision_maker: "Decision-maker",
  other: "Other",
};

// 50 states + DC for the dropdown.
export const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export type Prospect = {
  id: number;
  business_name: string;
  industry: ProspectIndustry | null;
  size: ProspectSize | null;
  city: string | null;
  state: string | null;
  website_url: string | null;
  status: ProspectStatus;
  service_interest: ServiceInterest[];
  notes: string;
  next_action: string | null;
  next_action_date: string | null; // ISO date
  source: ProspectSource | null;
  created_at: Date;
  updated_at: Date;
};

export type ProspectContact = {
  id: number;
  prospect_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: ContactRole | null;
  is_primary: boolean;
  notes: string;
  created_at: Date;
};

export type ProspectActivityRow = {
  id: number;
  prospect_id: number;
  kind: ActivityKind;
  content: string;
  draft_id: number | null;
  created_by: string;
  created_at: Date;
};
