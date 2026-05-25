/**
 * MCP server endpoint for Farley Creative Hub.
 *
 * Implements the Model Context Protocol over HTTP (JSON-RPC). Agents
 * connect by adding this URL as a custom MCP server in their Claude
 * config, with the bearer token in the Authorization header.
 *
 * Available tools (will grow as features land):
 *   - get_hub_preferences / update_hub_preferences
 *   - get_studio_brand_kit / update_studio_brand_kit
 *   - list_assets
 *
 * Bearer-token auth via the same agent_tokens table as the REST API.
 * Cookie auth isn't supported here — MCP clients send headers, not cookies.
 *
 * Protocol notes:
 * - JSON-RPC 2.0 over POST
 * - Methods handled: initialize, notifications/initialized, tools/list, tools/call
 * - Notifications (no `id`) return 204 No Content
 */

import { NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/db/agent-tokens";
import { getHubPreferences, updateHubPreferences } from "@/lib/db/hub-preferences";
import {
  createClientKit,
  getBrandKit,
  getStudioKit,
  listBrandKits,
  updateBrandKit,
} from "@/lib/db/brand-kits";
import { listAssets } from "@/lib/db/assets";
import {
  createDraft,
  DRAFT_KINDS,
  DRAFT_STATUSES,
  listDrafts,
  type DraftKind,
  type DraftStatus,
} from "@/lib/db/drafts";
import { draftWithClaude } from "@/lib/ai/claude";
import {
  createContact,
  createProspect,
  getProspect,
  listActivity,
  listContacts,
  listProspects,
  logActivity,
  updateProspect,
  type ActivityKind,
  type ContactRole,
  type ProspectIndustry,
  type ProspectSize,
  type ProspectStatus,
  type ServiceInterest,
} from "@/lib/db/prospects";
import {
  CONTACT_ROLES,
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
  SERVICE_INTERESTS,
} from "@/lib/pipeline-shared";
import {
  createLead,
  getLead,
  listLeads,
  type LeadSourceType,
  type LeadStatus,
} from "@/lib/db/leads";
import { LEAD_SOURCE_TYPES, LEAD_STATUSES } from "@/lib/leads-shared";
import { fetchUrlToText, parseLead } from "@/lib/ai/parse-lead";
import {
  createCadence,
  createStep,
  getCadenceWithSteps,
  listCadences,
  listSteps,
} from "@/lib/db/cadences";
import {
  cancelEnrollment,
  createEnrollment,
  getEnrollment,
  listDraftedSends,
  listEnrollments,
  listEnrollmentsForProspect,
  listSendsForEnrollment,
  pauseEnrollment,
  resumeEnrollment,
} from "@/lib/db/enrollments";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/lib/cadences-shared";
import { query } from "@/lib/db/client";

const ACTIVITY_KINDS: ActivityKind[] = [
  "email_sent", "call", "meeting", "proposal_sent", "note", "status_change",
];

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "farley-creative-hub";
const SERVER_VERSION = "0.1.0";

const HEX_COLOR_OR_EMPTY = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

type ToolContext = { agentId: number; agentName: string };

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: "get_hub_preferences",
    description:
      "Read the Hub's look-and-feel settings (operator chrome): hub_label and accent_color. Returns the single hub_preferences row.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => getHubPreferences(),
  },
  {
    name: "update_hub_preferences",
    description:
      "Update the Hub's look-and-feel settings. Only pass fields you want to change. accent_color must be a hex value like #c97d5d. favicon_url should be a public image URL (PNG/JPEG/SVG/etc.); pass null to clear and fall back to the default F mark.",
    inputSchema: {
      type: "object",
      properties: {
        hub_label: { type: "string" },
        accent_color: {
          type: "string",
          pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
        },
        favicon_url: {
          type: ["string", "null"],
          description:
            "Public URL of a custom favicon image. Pass null to clear (Hub falls back to the generated F mark). To upload a file, use the form at /settings instead — there's no direct file-upload tool here.",
        },
      },
    },
    handler: async (args) => {
      const updates: Record<string, unknown> = {};
      if (typeof args.hub_label === "string") updates.hub_label = args.hub_label;
      if (typeof args.accent_color === "string") updates.accent_color = args.accent_color;
      if (args.favicon_url === null || typeof args.favicon_url === "string") {
        updates.favicon_url = args.favicon_url;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return updateHubPreferences(updates as any);
    },
  },
  {
    name: "get_studio_brand_kit",
    description:
      "Read the studio's brand kit — the studio's name, bio, voice notes, brand book notes, color palette (primary/secondary/accent), and social URLs. Use this to ground listing copy, customer messages, and any other voice-sensitive output.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => getStudioKit(),
  },
  {
    name: "update_studio_brand_kit",
    description:
      "Update the studio's brand kit. Pass only fields to change. Colors must be hex values or empty strings.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" },
        primary_color: { type: "string" },
        secondary_color: { type: "string" },
        accent_color: { type: "string" },
        voice_notes: { type: "string" },
        brand_book_notes: { type: "string" },
        etsy_shop_url: { type: "string" },
        website_url: { type: "string" },
        instagram_url: { type: "string" },
        pinterest_url: { type: "string" },
      },
    },
    handler: async (args) => {
      const stringFields = [
        "name",
        "bio",
        "primary_color",
        "secondary_color",
        "accent_color",
        "voice_notes",
        "brand_book_notes",
        "etsy_shop_url",
        "website_url",
        "instagram_url",
        "pinterest_url",
      ];
      const updates: Record<string, string> = {};
      for (const f of stringFields) {
        if (typeof args[f] === "string") updates[f] = args[f] as string;
      }
      // Validate colors
      for (const f of ["primary_color", "secondary_color", "accent_color"] as const) {
        const v = updates[f];
        if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
          throw new Error(`${f.replace(/_/g, " ")} must be a hex value like #c97d5d, or empty`);
        }
      }
      const kit = await getStudioKit();
      return updateBrandKit(kit.id, updates as never);
    },
  },
  {
    name: "list_assets",
    description:
      "List assets in the studio's library — logos, brand books, design masters, design exports, or general files. Optionally filter by kind or by linked brand kit. Returns metadata + the public URL of each asset.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["general", "logo", "brand_book", "design_master", "design_export"],
        },
        brand_kit_id: { type: ["integer", "null"] },
      },
    },
    handler: async (args) => {
      const filter: { kind?: string; brand_kit_id?: number | null } = {};
      if (typeof args.kind === "string") filter.kind = args.kind;
      if (args.brand_kit_id !== undefined) {
        filter.brand_kit_id = args.brand_kit_id as number | null;
      }
      return listAssets(filter as never);
    },
  },
  {
    name: "list_drafts",
    description:
      "List drafts already in the Hub — Etsy listing copy, Pinterest pin captions, customer replies, social posts, blog drafts, email drafts. Optionally filter by status (draft/approved/published/archived) or kind. Use this before creating a new draft to avoid duplicates and to find drafts to refine.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: DRAFT_STATUSES as unknown as string[] },
        kind: { type: "string", enum: DRAFT_KINDS as unknown as string[] },
      },
    },
    handler: async (args) => {
      const filter: { status?: DraftStatus; kind?: DraftKind } = {};
      if (typeof args.status === "string") filter.status = args.status as DraftStatus;
      if (typeof args.kind === "string") filter.kind = args.kind as DraftKind;
      return listDrafts(filter);
    },
  },
  {
    name: "create_draft",
    description:
      "Create a draft in the Hub. Two modes: (1) pass a prompt and Claude drafts content grounded in the specified brand voice + brand book notes; (2) pass content directly to save text you've already drafted in the conversation. brand_kit_id picks which voice to use — defaults to studio. Provide a short title so it's findable later. Pick the correct kind so the draft formats appropriately. Drafts start in status 'draft' for review.",
    inputSchema: {
      type: "object",
      required: ["title", "kind"],
      properties: {
        title: {
          type: "string",
          description: "Short label for finding this draft later (not the output content).",
        },
        kind: {
          type: "string",
          enum: DRAFT_KINDS as unknown as string[],
          description:
            "What kind of draft: listing (Etsy), pin (Pinterest), customer_reply, social_post, blog, email, general.",
        },
        prompt: {
          type: "string",
          description:
            "What to draft (used if `content` is not provided). Claude drafts using the selected brand voice + brand book notes.",
        },
        content: {
          type: "string",
          description:
            "Pre-drafted content to save directly. If provided, skips the Claude call. Useful when you've already drafted in your conversation.",
        },
        brand_kit_id: {
          type: "integer",
          description:
            "Which brand kit's voice to draft in. Omit for studio voice. Use list_brand_kits to find client kit ids.",
        },
      },
    },
    handler: async (args, ctx) => {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      const kindRaw = typeof args.kind === "string" ? args.kind : "general";
      const kind: DraftKind = (DRAFT_KINDS as string[]).includes(kindRaw)
        ? (kindRaw as DraftKind)
        : "general";
      const prompt = typeof args.prompt === "string" ? args.prompt : "";
      const providedContent = typeof args.content === "string" ? args.content : null;

      if (!title) throw new Error("title is required");

      let content: string;
      let modelUsed: string | null = null;
      if (providedContent !== null) {
        content = providedContent;
      } else {
        if (!prompt) throw new Error("either prompt or content must be provided");
        const brand = await getStudioKit();
        const result = await draftWithClaude({ kind, prompt, brand });
        content = result.content;
        modelUsed = result.model;
      }

      // Resolve brand kit — use args.brand_kit_id if provided, else studio.
      let brand;
      const brandKitIdRaw = args.brand_kit_id;
      if (typeof brandKitIdRaw === "number") {
        brand = await getBrandKit(brandKitIdRaw);
        if (!brand) throw new Error(`brand_kit_id ${brandKitIdRaw} not found`);
      } else {
        brand = await getStudioKit();
      }

      // If content wasn't pre-supplied, draft via Claude using THIS kit.
      // (Override the earlier studio-only draft above.)
      if (providedContent === null && prompt) {
        const result = await draftWithClaude({ kind, prompt, brand });
        content = result.content;
        modelUsed = result.model;
      }

      return createDraft({
        title,
        kind,
        prompt,
        content,
        brand_kit_id: brand.id,
        model_used: modelUsed,
        created_by: `agent:${ctx.agentName}`,
      });
    },
  },
  {
    name: "list_brand_kits",
    description:
      "List all brand kits — the studio's own kit (is_studio_self: true) and any client brand kits the studio maintains. Use this to find a brand_kit_id when drafting in a specific client's voice.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => listBrandKits(),
  },
  {
    name: "get_brand_kit",
    description:
      "Read a specific brand kit by id (studio or client). Returns name, voice notes, brand book notes, color palette, social URLs.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
      },
    },
    handler: async (args) => {
      const id = args.id;
      if (typeof id !== "number") throw new Error("id required");
      const kit = await getBrandKit(id);
      if (!kit) throw new Error(`brand_kit_id ${id} not found`);
      return kit;
    },
  },
  {
    name: "create_client_brand_kit",
    description:
      "Create a new CLIENT brand kit (not the studio's own). Use when onboarding a new client whose brand the studio will be creating content for. Returns the new kit including its id, which can be passed to create_draft via brand_kit_id.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Client name (the brand name they go by)." },
        bio: { type: "string" },
        primary_color: { type: "string" },
        secondary_color: { type: "string" },
        accent_color: { type: "string" },
        voice_notes: { type: "string" },
        brand_book_notes: { type: "string" },
        etsy_shop_url: { type: "string" },
        website_url: { type: "string" },
        instagram_url: { type: "string" },
        pinterest_url: { type: "string" },
      },
    },
    handler: async (args) => {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) throw new Error("name is required");
      const input: Record<string, string> = { name };
      for (const f of [
        "bio",
        "primary_color",
        "secondary_color",
        "accent_color",
        "voice_notes",
        "brand_book_notes",
        "etsy_shop_url",
        "website_url",
        "instagram_url",
        "pinterest_url",
      ]) {
        if (typeof args[f] === "string") input[f] = (args[f] as string).trim();
      }
      for (const f of ["primary_color", "secondary_color", "accent_color"]) {
        const v = input[f];
        if (typeof v === "string" && !HEX_COLOR_OR_EMPTY.test(v)) {
          throw new Error(`${f.replace(/_/g, " ")} must be a hex value or empty`);
        }
      }
      return createClientKit(input as never);
    },
  },
  {
    name: "list_prospects",
    description:
      "List sales-pipeline prospects with optional filters. Use to see what's in the pipeline, what's due, who to follow up with. Filters: status (lead/contacted/discovery/proposal/negotiating/signed/passed/dormant), state (2-letter code), industry, size (solo/small/medium/larger), service (brand_identity/web_design/marketing/etc).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: PROSPECT_STATUSES as unknown as string[] },
        state: { type: "string", description: "2-letter US state code" },
        industry: { type: "string", enum: PROSPECT_INDUSTRIES as unknown as string[] },
        size: { type: "string", enum: PROSPECT_SIZES as unknown as string[] },
        service: { type: "string", enum: SERVICE_INTERESTS as unknown as string[] },
      },
    },
    handler: async (args) => {
      const filter: {
        status?: ProspectStatus; state?: string; industry?: ProspectIndustry;
        size?: ProspectSize; service?: ServiceInterest;
      } = {};
      if (typeof args.status === "string") filter.status = args.status as ProspectStatus;
      if (typeof args.state === "string") filter.state = args.state.toUpperCase();
      if (typeof args.industry === "string") filter.industry = args.industry as ProspectIndustry;
      if (typeof args.size === "string") filter.size = args.size as ProspectSize;
      if (typeof args.service === "string") filter.service = args.service as ServiceInterest;
      return listProspects(filter);
    },
  },
  {
    name: "get_prospect",
    description: "Get a prospect by id, including the full record (status, industry, services, next action, notes, etc.).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "integer" } },
    },
    handler: async (args) => {
      const id = args.id;
      if (typeof id !== "number") throw new Error("id required");
      const p = await getProspect(id);
      if (!p) throw new Error(`prospect ${id} not found`);
      const [contacts, activity] = await Promise.all([listContacts(id), listActivity(id)]);
      return { prospect: p, contacts, activity };
    },
  },
  {
    name: "create_prospect",
    description:
      "Create a new prospect in the pipeline. Just business_name is required — fill in the rest as you learn it. Returns the new prospect with its id.",
    inputSchema: {
      type: "object",
      required: ["business_name"],
      properties: {
        business_name: { type: "string" },
        industry: { type: "string", enum: PROSPECT_INDUSTRIES as unknown as string[] },
        size: { type: "string", enum: PROSPECT_SIZES as unknown as string[] },
        city: { type: "string" },
        state: { type: "string", description: "2-letter US state code" },
        website_url: { type: "string" },
        status: { type: "string", enum: PROSPECT_STATUSES as unknown as string[] },
        service_interest: { type: "array", items: { type: "string", enum: SERVICE_INTERESTS as unknown as string[] } },
        notes: { type: "string" },
        next_action: { type: "string" },
        next_action_date: { type: "string", description: "YYYY-MM-DD" },
        source: { type: "string", enum: PROSPECT_SOURCES as unknown as string[] },
      },
    },
    handler: async (args) => {
      const business_name = typeof args.business_name === "string" ? args.business_name.trim() : "";
      if (!business_name) throw new Error("business_name required");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createProspect({ ...args, business_name } as any);
    },
  },
  {
    name: "update_prospect",
    description:
      "Update a prospect. Pass id + any fields to change. Use to advance status, set next_action, add notes, etc.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        business_name: { type: "string" },
        industry: { type: "string", enum: PROSPECT_INDUSTRIES as unknown as string[] },
        size: { type: "string", enum: PROSPECT_SIZES as unknown as string[] },
        city: { type: "string" },
        state: { type: "string" },
        website_url: { type: "string" },
        status: { type: "string", enum: PROSPECT_STATUSES as unknown as string[] },
        service_interest: { type: "array", items: { type: "string", enum: SERVICE_INTERESTS as unknown as string[] } },
        notes: { type: "string" },
        next_action: { type: "string" },
        next_action_date: { type: "string" },
        source: { type: "string", enum: PROSPECT_SOURCES as unknown as string[] },
      },
    },
    handler: async (args) => {
      const id = args.id;
      if (typeof id !== "number") throw new Error("id required");
      const { id: _id, ...updates } = args;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return updateProspect(id, updates as any);
    },
  },
  {
    name: "add_prospect_contact",
    description:
      "Add a contact to a prospect (e.g. the owner, marketing lead, decision-maker). is_primary=true marks them as the primary contact and demotes any other primary.",
    inputSchema: {
      type: "object",
      required: ["prospect_id", "name"],
      properties: {
        prospect_id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        role: { type: "string", enum: CONTACT_ROLES as unknown as string[] },
        is_primary: { type: "boolean" },
        notes: { type: "string" },
      },
    },
    handler: async (args) => {
      const prospect_id = args.prospect_id;
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (typeof prospect_id !== "number") throw new Error("prospect_id required");
      if (!name) throw new Error("name required");
      return createContact({
        prospect_id,
        name,
        email: typeof args.email === "string" ? args.email : null,
        phone: typeof args.phone === "string" ? args.phone : null,
        role: typeof args.role === "string" ? (args.role as ContactRole) : null,
        is_primary: args.is_primary === true,
        notes: typeof args.notes === "string" ? args.notes : "",
      });
    },
  },
  {
    name: "log_prospect_activity",
    description:
      "Log activity on a prospect — email sent, call, meeting, proposal sent, or a free-form note. Use after any real outreach so the timeline stays current.",
    inputSchema: {
      type: "object",
      required: ["prospect_id", "kind"],
      properties: {
        prospect_id: { type: "integer" },
        kind: { type: "string", enum: ACTIVITY_KINDS as unknown as string[] },
        content: { type: "string", description: "What happened, in your own words." },
        draft_id: { type: "integer", description: "If the activity references an existing draft, pass its id." },
      },
    },
    handler: async (args, ctx) => {
      const prospect_id = args.prospect_id;
      const kind = args.kind;
      if (typeof prospect_id !== "number") throw new Error("prospect_id required");
      if (typeof kind !== "string" || !(ACTIVITY_KINDS as string[]).includes(kind)) {
        throw new Error("kind required + must be one of: " + ACTIVITY_KINDS.join(", "));
      }
      return logActivity({
        prospect_id,
        kind: kind as ActivityKind,
        content: typeof args.content === "string" ? args.content : "",
        draft_id: typeof args.draft_id === "number" ? args.draft_id : null,
        created_by: `agent:${ctx.agentName}`,
      });
    },
  },
  {
    name: "list_leads",
    description:
      "List sourced leads (signals to triage — job postings, RFPs, article mentions, referrals). Use to see what's in the lead queue, what's still 'new' to review. Filters: status (new/reviewing/qualified/converted/dismissed), source_type, state.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: LEAD_STATUSES as unknown as string[] },
        source_type: { type: "string", enum: LEAD_SOURCE_TYPES as unknown as string[] },
        state: { type: "string", description: "2-letter US state code" },
      },
    },
    handler: async (args) => {
      const filter: { status?: LeadStatus; source_type?: LeadSourceType; state?: string } = {};
      if (typeof args.status === "string") filter.status = args.status as LeadStatus;
      if (typeof args.source_type === "string") filter.source_type = args.source_type as LeadSourceType;
      if (typeof args.state === "string") filter.state = args.state.toUpperCase();
      return listLeads(filter);
    },
  },
  {
    name: "create_lead",
    description:
      "Capture a new lead from a sourced signal — a job posting, RFP, article, social post, referral mention, or cold-list entry. Paste the raw_content (the posting body, article text, etc.) so it stays attached to the lead. fields you fill in (business_name, city, state, industry, size, service_signal) get carried into a prospect later if you convert.",
    inputSchema: {
      type: "object",
      required: ["source_type"],
      properties: {
        source_type: { type: "string", enum: LEAD_SOURCE_TYPES as unknown as string[] },
        source_url: { type: "string" },
        source_title: { type: "string", description: 'e.g. "Marketing Manager at Acme Co"' },
        business_name: { type: "string" },
        city: { type: "string" },
        state: { type: "string", description: "2-letter US state code" },
        industry: { type: "string", enum: PROSPECT_INDUSTRIES as unknown as string[] },
        size: { type: "string", enum: PROSPECT_SIZES as unknown as string[] },
        service_signal: {
          type: "array",
          items: { type: "string", enum: SERVICE_INTERESTS as unknown as string[] },
          description: "What services they may need, inferred from the source.",
        },
        raw_content: { type: "string", description: "Full text of the posting / article body / RFP." },
        notes: { type: "string", description: "Your own thoughts on why this is interesting." },
      },
    },
    handler: async (args, ctx) => {
      const source_type = (args.source_type as LeadSourceType) ?? "other";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createLead({ ...args, source_type, found_by: `agent:${ctx.agentName}` } as any);
    },
  },
  {
    name: "parse_lead_source",
    description:
      "Parse a raw job posting / article / RFP / social post into structured lead fields using Claude. Returns business_name, source_title, city, state, industry, size, service_signal, summary. Does NOT save — pass the parsed fields to create_lead to actually capture. Pass either `text` (paste the body) or `url` (server fetches; may fail on Indeed/LinkedIn which block server fetches).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Raw posting/article/RFP body to parse." },
        url: { type: "string", description: "Source URL — server tries to fetch + extract text." },
      },
    },
    handler: async (args) => {
      const url = typeof args.url === "string" ? args.url.trim() : "";
      let text = typeof args.text === "string" ? args.text.trim() : "";
      if (!text && url) {
        text = await fetchUrlToText(url);
      }
      if (!text) {
        throw new Error("Pass either `text` (raw body) or `url` (server will fetch).");
      }
      return parseLead(text);
    },
  },
  {
    name: "convert_lead_to_prospect",
    description:
      "Promote a lead to an active prospect once you decide to pursue. Requires the lead to have a business_name. Creates a prospect with the lead's fields pre-filled, links the lead to the new prospect, flips lead status to 'converted', and logs the source on the prospect timeline. Returns the new prospect id.",
    inputSchema: {
      type: "object",
      required: ["lead_id"],
      properties: { lead_id: { type: "integer" } },
    },
    handler: async (args, ctx) => {
      const lead_id = args.lead_id;
      if (typeof lead_id !== "number") throw new Error("lead_id required");
      const lead = await getLead(lead_id);
      if (!lead) throw new Error(`lead ${lead_id} not found`);
      if (!lead.business_name?.trim()) {
        throw new Error("lead is missing business_name — fill it in before converting");
      }
      if (lead.status === "converted" && lead.converted_to_prospect_id) {
        return {
          alreadyConverted: true,
          prospect_id: lead.converted_to_prospect_id,
        };
      }

      const industry =
        lead.industry && (PROSPECT_INDUSTRIES as unknown as string[]).includes(lead.industry)
          ? lead.industry
          : null;
      const size =
        lead.size && (PROSPECT_SIZES as unknown as string[]).includes(lead.size)
          ? lead.size
          : null;
      const services = lead.service_signal.filter((s) =>
        (SERVICE_INTERESTS as unknown as string[]).includes(s),
      );

      const sourceLine = `Source: ${lead.source_type}`;
      const urlLine = lead.source_url ? `\nURL: ${lead.source_url}` : "";
      const titleLine = lead.source_title ? `\nTitle: ${lead.source_title}` : "";
      const carriedNotes = lead.notes.trim() ? `\n\nNotes from lead:\n${lead.notes.trim()}` : "";
      const prospectNotes = `${sourceLine}${urlLine}${titleLine}${carriedNotes}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prospect = await createProspect({
        business_name: lead.business_name.trim(),
        industry,
        size,
        city: lead.city,
        state: lead.state,
        status: "lead",
        service_interest: services,
        notes: prospectNotes,
        next_action: "Initial outreach",
        source: lead.source_type === "referral_mention" ? "referral" : "other",
      } as any);

      await query(
        `UPDATE leads SET status = 'converted', converted_to_prospect_id = $1, updated_at = NOW() WHERE id = $2`,
        [prospect.id, lead.id],
      );

      await logActivity({
        prospect_id: prospect.id,
        kind: "note",
        content: `Converted from lead #${lead.id} (${lead.source_type}${lead.source_url ? ` — ${lead.source_url}` : ""})`,
        draft_id: null,
        created_by: `agent:${ctx.agentName}`,
      }).catch(() => null);

      return { prospect_id: prospect.id, lead_id: lead.id };
    },
  },

  // ============ Cadences ============

  {
    name: "list_cadences",
    description:
      "List outreach cadences — reusable multi-step email sequences. Each cadence has a name + ordered steps. Prospects enroll in a cadence; the Hub drafts each step into the operator's Gmail Drafts folder at its scheduled time for human review + send. By default lists only active cadences; pass include_inactive: true to include archived ones.",
    inputSchema: {
      type: "object",
      properties: {
        include_inactive: { type: "boolean" },
      },
    },
    handler: async (args) => {
      const includeInactive = args.include_inactive === true;
      return { cadences: await listCadences(includeInactive) };
    },
  },
  {
    name: "get_cadence",
    description:
      "Get a single cadence by id, including its ordered steps (step_number, delay_days, delay_hours, draft_prompt, subject_template). Use this before adding new steps or enrolling a prospect, so you know what's already there.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const id = Number(args.id);
      const cadence = await getCadenceWithSteps(id);
      if (!cadence) throw new Error(`Cadence #${id} not found`);
      return cadence;
    },
  },
  {
    name: "create_cadence",
    description:
      "Create a new outreach cadence. The cadence is empty (no steps yet) — call add_cadence_step to populate it. brand_kit_id selects the voice the Hub will draft each step in; defaults to the studio brand kit. Returns the new cadence id which you'll need for add_cadence_step and enroll_prospect.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        brand_kit_id: {
          type: "integer",
          description:
            "Brand kit id whose voice drafts will use. Defaults to the studio kit. Use list_brand_kits to find client kit ids.",
        },
      },
      required: ["name"],
    },
    handler: async (args, ctx) => {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) throw new Error("name is required");
      return createCadence({
        name,
        description: typeof args.description === "string" ? args.description : "",
        brand_kit_id:
          typeof args.brand_kit_id === "number" ? args.brand_kit_id : null,
        created_by: `agent:${ctx.agentName}`,
      });
    },
  },
  {
    name: "add_cadence_step",
    description:
      "Append a step to an existing cadence. Steps run in order; delay is relative to the previous step (or to enrollment time for step 1). draft_prompt is the prompt Claude will use to draft each email at send time — it's the seed instruction, NOT the literal email body. Example draft_prompt: 'Polite follow-up after no reply — restate the value prop in one sentence and ask if a different time works.' subject_template is optional; if set it's used literally, otherwise Claude drafts the subject too.",
    inputSchema: {
      type: "object",
      properties: {
        cadence_id: { type: "integer" },
        delay_days: { type: "integer", minimum: 0 },
        delay_hours: { type: "integer", minimum: 0, maximum: 23 },
        draft_prompt: { type: "string" },
        subject_template: { type: "string" },
      },
      required: ["cadence_id", "draft_prompt"],
    },
    handler: async (args) => {
      const cadenceId = Number(args.cadence_id);
      const draftPrompt =
        typeof args.draft_prompt === "string" ? args.draft_prompt.trim() : "";
      if (!draftPrompt) throw new Error("draft_prompt is required");
      const existing = await listSteps(cadenceId);
      return createStep({
        cadence_id: cadenceId,
        step_number: existing.length + 1,
        delay_days: typeof args.delay_days === "number" ? args.delay_days : 0,
        delay_hours: typeof args.delay_hours === "number" ? args.delay_hours : 0,
        draft_prompt: draftPrompt,
        subject_template:
          typeof args.subject_template === "string"
            ? args.subject_template.trim() || null
            : null,
      });
    },
  },

  // ============ Enrollments ============

  {
    name: "list_enrollments",
    description:
      "List prospect enrollments (the runtime instances of a cadence applied to a specific prospect). Optionally filter by status: 'active' (cron is processing it), 'paused' (manually paused), 'completed' (all steps drafted), 'cancelled' (terminal).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ENROLLMENT_STATUSES },
      },
    },
    handler: async (args) => {
      const status =
        typeof args.status === "string" &&
        (ENROLLMENT_STATUSES as string[]).includes(args.status)
          ? (args.status as EnrollmentStatus)
          : undefined;
      return { enrollments: await listEnrollments(status ? { status } : undefined) };
    },
  },
  {
    name: "get_enrollment",
    description:
      "Get a single enrollment with its send history (drafted/sent emails for this prospect on this cadence). Useful for seeing what's already been drafted to the prospect, what status each send is in, and what step is next.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const id = Number(args.id);
      const enrollment = await getEnrollment(id);
      if (!enrollment) throw new Error(`Enrollment #${id} not found`);
      const sends = await listSendsForEnrollment(id);
      return { enrollment, sends };
    },
  },
  {
    name: "list_enrollments_for_prospect",
    description:
      "List all enrollments (past + active) for a specific prospect. Use to check whether a prospect already has an active enrollment before trying to enroll them again (only one active enrollment per prospect allowed).",
    inputSchema: {
      type: "object",
      properties: {
        prospect_id: { type: "integer" },
      },
      required: ["prospect_id"],
    },
    handler: async (args) => {
      const prospectId = Number(args.prospect_id);
      return { enrollments: await listEnrollmentsForProspect(prospectId) };
    },
  },
  {
    name: "enroll_prospect",
    description:
      "Enroll a prospect in a cadence. Sets status='active' and schedules the first step at NOW + step1's delay. Cron tick will draft each step into the operator's Gmail Drafts folder when its time arrives. Only one active enrollment per prospect; surfaces a 'already-enrolled' error if the prospect already has an active one (pause or cancel that one first). Prospect must have at least one contact with an email or the cron will skip sending.",
    inputSchema: {
      type: "object",
      properties: {
        prospect_id: { type: "integer" },
        cadence_id: { type: "integer" },
      },
      required: ["prospect_id", "cadence_id"],
    },
    handler: async (args, ctx) => {
      const prospectId = Number(args.prospect_id);
      const cadenceId = Number(args.cadence_id);
      try {
        return await createEnrollment({
          prospect_id: prospectId,
          cadence_id: cadenceId,
          enrolled_by: `agent:${ctx.agentName}`,
        });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("prospect_enrollments_active_idx")) {
          throw new Error(
            "This prospect already has an active enrollment. Pause or cancel it first.",
          );
        }
        throw err;
      }
    },
  },
  {
    name: "pause_enrollment",
    description:
      "Pause an active enrollment. The cron stops drafting new steps. Use resume_enrollment to start it back up.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: ["id"],
    },
    handler: async (args) => pauseEnrollment(Number(args.id)),
  },
  {
    name: "resume_enrollment",
    description:
      "Resume a previously paused enrollment. The next step's send time is recomputed from NOW + its delay.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
      },
      required: ["id"],
    },
    handler: async (args) => resumeEnrollment(Number(args.id)),
  },
  {
    name: "cancel_enrollment",
    description:
      "Cancel an enrollment terminally. Status flips to 'cancelled'; no further drafts. Use when a prospect has explicitly opted out or the cadence no longer applies. Optionally pass a reason for the audit trail.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        reason: { type: "string" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const reason = typeof args.reason === "string" ? args.reason : undefined;
      return cancelEnrollment(Number(args.id), reason);
    },
  },
  {
    name: "list_drafted_sends",
    description:
      "List cadence emails currently drafted in the operator's Gmail Drafts folder, awaiting human review + send. Each entry shows the prospect, subject, body, and when it was drafted. The operator sends each one manually from Gmail — the Hub never auto-sends. Use this to see what's queued for review.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    handler: async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 20;
      return { drafted_sends: await listDraftedSends(limit) };
    },
  },
];

/**
 * Auth: extract + verify bearer token. Returns the agent record or
 * a Response (which the route should immediately return) on failure.
 */
async function authenticate(request: Request): Promise<{ tokenId: number; tokenName: string } | Response> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return jsonRpcError(null, -32001, "unauthorized — missing Bearer token", 401);
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return jsonRpcError(null, -32001, "unauthorized — empty token", 401);
  }
  const agent = await verifyAgentToken(token);
  if (!agent) {
    return jsonRpcError(null, -32001, "unauthorized — invalid token", 401);
  }
  return { tokenId: agent.id, tokenName: agent.name };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200, data?: unknown) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message, data } },
    { status },
  );
}

export async function POST(request: Request) {
  // Auth first — applies to every request after the initialize handshake.
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  let body: { jsonrpc?: string; method?: string; params?: Record<string, unknown>; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "parse error", 400);
  }

  const { method, params, id } = body;

  // Notifications (no id) return 204.
  const isNotification = id === undefined || id === null;

  if (!method) {
    if (isNotification) return new Response(null, { status: 204 });
    return jsonRpcError(id, -32600, "invalid request — missing method");
  }

  try {
    switch (method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} },
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return new Response(null, { status: 204 });

      case "ping":
        return jsonRpcResult(id, {});

      case "tools/list":
        return jsonRpcResult(id, {
          tools: TOOLS.map(({ handler: _h, ...rest }) => rest),
        });

      case "tools/call": {
        const name = params?.name;
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        if (typeof name !== "string") {
          return jsonRpcError(id, -32602, "invalid params — name required");
        }
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
          return jsonRpcError(id, -32601, `tool not found: ${name}`);
        }
        try {
          const result = await tool.handler(args, {
            agentId: authResult.tokenId,
            agentName: authResult.tokenName,
          });
          return jsonRpcResult(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
        } catch (err) {
          return jsonRpcResult(id, {
            content: [
              {
                type: "text",
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          });
        }
      }

      default:
        if (isNotification) return new Response(null, { status: 204 });
        return jsonRpcError(id, -32601, `method not found: ${method}`);
    }
  } catch (err) {
    console.error("[mcp] internal error", err);
    return jsonRpcError(id, -32603, `internal error: ${(err as Error).message}`);
  }
}

/**
 * GET responds with server info — useful for sanity-checking the URL
 * works without speaking MCP. Doesn't require auth so probes from a
 * browser show something.
 */
export async function GET() {
  return NextResponse.json({
    server: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: PROTOCOL_VERSION,
    transport: "streamable-http",
    note: "POST JSON-RPC 2.0 requests with `Authorization: Bearer <fch_…>` header.",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
