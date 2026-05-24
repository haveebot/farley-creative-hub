/**
 * POST /api/leads/[id]/convert
 *
 * Convert a lead into a prospect. Creates a new prospect with the
 * lead's fields pre-filled, links the lead via converted_to_prospect_id,
 * flips lead status to 'converted', and logs an activity on the new
 * prospect noting the lead source.
 *
 * Returns: { ok: true, lead, prospect }
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getLead, updateLead } from "@/lib/db/leads";
import { createProspect, logActivity } from "@/lib/db/prospects";
import { LEAD_SOURCE_LABELS } from "@/lib/leads-shared";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  type ProspectIndustry,
  type ProspectSize,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  const lead = await getLead(numId);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (lead.status === "converted" && lead.converted_to_prospect_id) {
    return NextResponse.json(
      { ok: false, error: "already-converted", prospect_id: lead.converted_to_prospect_id },
      { status: 409 },
    );
  }
  if (!lead.business_name || !lead.business_name.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "business-name-required",
        message: "Lead needs a business name before it can convert to a prospect.",
      },
      { status: 400 },
    );
  }

  // Map lead fields to prospect fields (only where they overlap with prospect enums).
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

  // Build prospect notes that preserve lead context.
  const sourceLine = `Source: ${LEAD_SOURCE_LABELS[lead.source_type] ?? lead.source_type}`;
  const urlLine = lead.source_url ? `\nURL: ${lead.source_url}` : "";
  const titleLine = lead.source_title ? `\nTitle: ${lead.source_title}` : "";
  const carriedNotes = lead.notes.trim() ? `\n\nNotes from lead:\n${lead.notes.trim()}` : "";
  const prospectNotes = `${sourceLine}${urlLine}${titleLine}${carriedNotes}`;

  try {
    const prospect = await createProspect({
      business_name: lead.business_name.trim(),
      industry,
      size,
      city: lead.city,
      state: lead.state,
      website_url: null, // not on leads; she'll add it
      status: "lead", // start in active pipeline as a fresh lead status
      service_interest: services,
      notes: prospectNotes,
      next_action: "Initial outreach",
      next_action_date: null,
      source: lead.source_type === "referral_mention" ? "referral" : "other",
    });

    // Mark the lead as converted, link to the new prospect.
    const updatedLead = await updateLead(lead.id, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(({
        status: "converted",
      } as unknown) as any),
    });
    // Separate update to set the prospect link (column not in LeadUpdate type by design).
    const { query } = await import("@/lib/db/client");
    await query(`UPDATE leads SET converted_to_prospect_id = $1 WHERE id = $2`, [
      prospect.id,
      lead.id,
    ]);

    // Log activity on the new prospect.
    await logActivity({
      prospect_id: prospect.id,
      kind: "note",
      content: `Converted from lead #${lead.id} (${LEAD_SOURCE_LABELS[lead.source_type] ?? lead.source_type}${lead.source_url ? ` — ${lead.source_url}` : ""})`,
      draft_id: null,
      created_by: createdByLabel(auth),
    }).catch((err) => console.warn("[convert] activity log failed", err));

    return NextResponse.json({
      ok: true,
      lead: { ...updatedLead, converted_to_prospect_id: prospect.id },
      prospect,
    });
  } catch (err) {
    console.error("[api/leads/[id]/convert] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
