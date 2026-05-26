/**
 * POST /api/leads/[id]/draft-first-touch
 *
 * Generate a custom first-touch email for a job-board lead and land it
 * in the connected Workspace Gmail Drafts folder. Operator (Collie) then
 * reviews + sends from Gmail.
 *
 * Flow:
 *   1. Resolve JD content via hybrid fetch (URL → stored → operator paste)
 *   2. Call Claude with composition template + brand kit + voice profile
 *   3. Best-effort extract a recipient email from the JD (or leave blank
 *      for the operator to fill in Gmail)
 *   4. Create the Gmail draft via createGmailDraft
 *   5. Stamp lead with first_touch_* tracking columns
 *   6. Append a note line to lead.notes for traceability
 *
 * Lead is NOT auto-promoted to prospect — Collie does that herself after
 * sending, via the existing Convert button. Keeps the state model clean:
 * a lead with a first-touch drafted is still a lead until she signals
 * intent by promoting.
 *
 * Request body (optional):
 *   { operator_pasted?: string }  — full JD text if URL + stored are thin
 *
 * Response:
 *   {
 *     ok: true,
 *     analysis: { role, constraint, lever },
 *     subject, body, recipient_guess,
 *     gmail: { draftId, gmailUrl },
 *     source: { origin, chars, fetch_failed?, fetch_error? },
 *     lead: <updated lead row>
 *   }
 */
import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { getStudioKit } from "@/lib/db/brand-kits";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import { createGmailDraft } from "@/lib/gmail/send";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { createProspect, logActivity } from "@/lib/db/prospects";
import { query } from "@/lib/db/client";
import { LEAD_SOURCE_LABELS } from "@/lib/leads-shared";
import type { Lead } from "@/lib/leads-shared";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
  type ProspectIndustry,
  type ProspectSize,
  type ServiceInterest,
} from "@/lib/pipeline-shared";

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}

async function ensureProspectForLead(
  lead: Lead,
  auth: AuthContext,
): Promise<{ prospect_id: number; was_already: boolean; prospect_name: string }> {
  // Already converted? Reuse existing prospect link.
  if (lead.converted_to_prospect_id) {
    return {
      prospect_id: lead.converted_to_prospect_id,
      was_already: true,
      prospect_name: lead.business_name ?? "(unnamed)",
    };
  }

  // Need a business name to promote. If absent, skip auto-promote
  // (the operator can fill it + run Convert manually).
  if (!lead.business_name || !lead.business_name.trim()) {
    return { prospect_id: 0, was_already: false, prospect_name: "" };
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
    created_by: createdByLabel(auth),
  }).catch((err) => console.warn("[draft-first-touch] activity log failed", err));

  return {
    prospect_id: prospect.id,
    was_already: false,
    prospect_name: prospect.business_name,
  };
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function guessRecipientEmail(jd: string): string | null {
  const match = jd.match(EMAIL_RE);
  if (!match) return null;
  // Filter out obvious non-recipient emails (noreply, do-not-reply, etc).
  const email = match[0].toLowerCase();
  if (/(noreply|no-reply|do-not-reply|donotreply)/.test(email)) return null;
  return match[0];
}

export async function POST(
  request: Request,
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

  // Require Workspace 'sending' connection before drafting — otherwise
  // we'd generate copy with nowhere to land it.
  const workspace = await getConnectionByPurpose("sending");
  if (!workspace) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-workspace",
        message:
          "Connect a Workspace 'sending' mailbox at /settings/workspace before drafting first-touches.",
      },
      { status: 400 },
    );
  }

  let body: { operator_pasted?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine.
  }

  const brand = await getStudioKit();
  const voice = await getDefaultVoiceProfile();

  let drafted;
  try {
    drafted = await draftFirstTouch({
      lead,
      brand,
      voice,
      operator_pasted: body.operator_pasted,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "draft-failed",
        message: (err as Error).message,
      },
      { status: 400 },
    );
  }

  const recipientGuess = guessRecipientEmail(drafted.raw_content_used);

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: recipientGuess ?? "",
      subject: drafted.subject,
      text: drafted.body,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "gmail-draft-failed",
        message: (err as Error).message,
        // Surface the draft so the operator can still copy/paste it manually
        // even if Gmail failed.
        analysis: drafted.analysis,
        subject: drafted.subject,
        body: drafted.body,
      },
      { status: 502 },
    );
  }

  // Auto-promote lead → prospect (if not already promoted and business_name present)
  const promotion = await ensureProspectForLead(lead, auth);

  // Stamp the lead row + append a traceable note.
  const noteLine = `[first-touch drafted ${new Date().toISOString().slice(0, 10)}] ${drafted.subject} (gmail draft ${gmailDraft.draftId}; JD via ${drafted.source.origin})`;
  const newNotes = lead.notes.trim()
    ? `${lead.notes.trim()}\n\n${noteLine}`
    : noteLine;

  await query(
    `UPDATE leads
        SET first_touch_drafted_at = NOW(),
            first_touch_gmail_draft_id = $1,
            first_touch_subject = $2,
            first_touch_jd_source = $3,
            notes = $4,
            updated_at = NOW()
      WHERE id = $5`,
    [gmailDraft.draftId, drafted.subject, drafted.source.origin, newNotes, numId],
  );

  // Log the email-drafted activity on the new (or existing) prospect so
  // it shows up in the prospect's timeline.
  if (promotion.prospect_id > 0) {
    await logActivity({
      prospect_id: promotion.prospect_id,
      kind: "email_drafted",
      content: `First-touch: ${drafted.subject} (review in Gmail Drafts)`,
      draft_id: null,
      created_by: createdByLabel(auth),
    }).catch((err) =>
      console.warn("[draft-first-touch] email_drafted activity log failed", err),
    );
  }

  const updated = await getLead(numId);

  // Gmail draft URL — opens the draft in the operator's Gmail UI.
  const gmailUrl = `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`;

  return NextResponse.json({
    ok: true,
    analysis: drafted.analysis,
    subject: drafted.subject,
    body: drafted.body,
    recipient_guess: recipientGuess,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl,
      sender: workspace.email,
    },
    source: drafted.source,
    lead: updated satisfies Lead | null,
    prospect: promotion.prospect_id > 0
      ? {
          id: promotion.prospect_id,
          was_already_converted: promotion.was_already,
          name: promotion.prospect_name,
          url: `/pipeline/${promotion.prospect_id}`,
        }
      : null,
  });
}
