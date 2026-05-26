/**
 * Lead → Prospect auto-promotion helper.
 *
 * Used by both the API route (`POST /api/leads/[id]/draft-first-touch`)
 * and the MCP tool (`draft_first_touch_for_lead`) so the workflow is
 * identical regardless of how the operator triggers the draft.
 *
 * Rules:
 * - If the lead is already converted, return the existing prospect_id
 *   (no-op idempotent).
 * - If the lead has no business_name, skip silently (caller can decide
 *   whether to error or proceed; auto-promote isn't always required).
 * - On promotion: prospect created with status='lead', lead status
 *   flipped to 'converted', lead.converted_to_prospect_id set, activity
 *   logged on the new prospect.
 */
import { LEAD_SOURCE_LABELS, type Lead } from "@/lib/leads-shared";
import { createProspect, logActivity } from "@/lib/db/prospects";
import { query } from "@/lib/db/client";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  type ProspectIndustry,
  type ProspectSize,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

export type PromotionResult = {
  prospect_id: number;
  was_already_converted: boolean;
  prospect_name: string;
};

export async function ensureProspectForLead(
  lead: Lead,
  createdByLabel: string,
): Promise<PromotionResult> {
  if (lead.converted_to_prospect_id) {
    return {
      prospect_id: lead.converted_to_prospect_id,
      was_already_converted: true,
      prospect_name: lead.business_name ?? "(unnamed)",
    };
  }

  if (!lead.business_name || !lead.business_name.trim()) {
    return { prospect_id: 0, was_already_converted: false, prospect_name: "" };
  }

  const industry =
    lead.industry && (PROSPECT_INDUSTRIES as string[]).includes(lead.industry)
      ? (lead.industry as ProspectIndustry)
      : null;
  const size =
    lead.size && (PROSPECT_SIZES as string[]).includes(lead.size)
      ? (lead.size as ProspectSize)
      : null;
  const services = lead.service_signal.filter(
    (s): s is ServiceInterest => (SERVICE_INTERESTS as string[]).includes(s),
  );

  const sourceLine = `Source: ${LEAD_SOURCE_LABELS[lead.source_type] ?? lead.source_type}`;
  const urlLine = lead.source_url ? `\nURL: ${lead.source_url}` : "";
  const titleLine = lead.source_title ? `\nTitle: ${lead.source_title}` : "";
  const carriedNotes = lead.notes.trim()
    ? `\n\nNotes from lead:\n${lead.notes.trim()}`
    : "";
  const prospectNotes = `${sourceLine}${urlLine}${titleLine}${carriedNotes}`;

  const prospect = await createProspect({
    business_name: lead.business_name.trim(),
    industry,
    size,
    city: lead.city,
    state: lead.state,
    website_url: null,
    status: "lead",
    service_interest: services,
    notes: prospectNotes,
    next_action: "Send drafted first-touch email",
    next_action_date: null,
    source: lead.source_type === "referral_mention" ? "referral" : "other",
  });

  await query(
    `UPDATE leads SET status='converted', converted_to_prospect_id=$1, updated_at=NOW() WHERE id=$2`,
    [prospect.id, lead.id],
  );

  await logActivity({
    prospect_id: prospect.id,
    kind: "note",
    content: `Auto-promoted from lead #${lead.id} on first-touch draft (${LEAD_SOURCE_LABELS[lead.source_type] ?? lead.source_type}${lead.source_url ? ` — ${lead.source_url}` : ""})`,
    draft_id: null,
    created_by: createdByLabel,
  }).catch((err) => console.warn("[promote] activity log failed", err));

  return {
    prospect_id: prospect.id,
    was_already_converted: false,
    prospect_name: prospect.business_name,
  };
}
