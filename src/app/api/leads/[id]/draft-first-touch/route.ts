/**
 * POST /api/leads/[id]/draft-first-touch
 *
 * Single-click first-touch flow:
 *   1. Draft the email via Claude (composition template + brand + voice)
 *   2. Enrich the company → in-memory roster (NO persistence, NO promote)
 *   3. Create the Gmail draft with NO recipients yet (operator picks
 *      next via the roster UI → back-fill endpoint)
 *   4. Stamp lead.first_touch_* tracking + return roster + draft link
 *
 * Lead is NOT promoted to a prospect. The roster is in-memory only
 * (returned in the response, not written to prospect_contacts). Drafting
 * is not contacting; promotion happens later via the existing Convert
 * button when the operator decides.
 *
 * Roster back-fill lives at POST /api/leads/[id]/set-recipients which
 * updates the existing Gmail draft with the operator's chosen TO list.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { getStudioKit } from "@/lib/db/brand-kits";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import { createGmailDraft } from "@/lib/gmail/send";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { enrichCompany } from "@/lib/ai/enrich-company";
import { query } from "@/lib/db/client";
import type { Lead } from "@/lib/leads-shared";

function recipientContextFromLead(lead: Lead): string {
  const role = lead.source_title ?? "unspecified role";
  const business = lead.business_name ?? "the company";
  return `${business} is hiring for: "${role}". This outreach is one email to multiple recipients on the TO line (Sage pattern: principals + function leader + relevant peers simultaneously). Surface ALL leadership-level contacts you can find: principal/founder/CEO, the function leader the new hire would report to (CMO for Marketing roles, Creative Director for Design roles), and any other senior leaders. Operator picks which to include.`;
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
    // empty body is fine
  }

  const brand = await getStudioKit();
  const voice = await getDefaultVoiceProfile();

  // 1. Draft the email (+ optionally enrich in parallel)
  const [draftedResult, enrichmentResult] = await Promise.allSettled([
    draftFirstTouch({
      lead,
      brand,
      voice,
      operator_pasted: body.operator_pasted,
    }),
    lead.business_name
      ? enrichCompany({
          business_name: lead.business_name,
          source_url: lead.source_url,
          source_title: lead.source_title,
          recipient_context: recipientContextFromLead(lead),
        })
      : Promise.resolve(null),
  ]);

  if (draftedResult.status === "rejected") {
    return NextResponse.json(
      {
        ok: false,
        error: "draft-failed",
        message: (draftedResult.reason as Error).message,
      },
      { status: 400 },
    );
  }
  const drafted = draftedResult.value;
  const enrichment =
    enrichmentResult.status === "fulfilled" ? enrichmentResult.value : null;

  // 2. Create the Gmail draft with NO recipients yet — operator picks via
  // the roster UI which back-fills via /set-recipients.
  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: "",
      subject: drafted.subject,
      text: drafted.body,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "gmail-draft-failed",
        message: (err as Error).message,
        analysis: drafted.analysis,
        subject: drafted.subject,
        body: drafted.body,
      },
      { status: 502 },
    );
  }

  // 3. Stamp the lead (do NOT promote)
  const noteLine = `[first-touch drafted ${new Date().toISOString().slice(0, 10)}] ${drafted.subject} (gmail draft ${gmailDraft.draftId}; JD via ${drafted.source.origin})`;
  const newNotes = lead.notes.trim()
    ? `${lead.notes.trim()}\n\n${noteLine}`
    : noteLine;

  // Persist enrichment so the roster survives refreshes / machine changes.
  // Stored on the LEAD (not promoted to a prospect). Operator manually
  // converts when ready.
  const contactsJson = enrichment
    ? enrichment.candidates.map((c, i) => ({
        name: c.name,
        title: c.title,
        email: c.email,
        source_url: c.source_url,
        notes: c.notes,
        is_ai_top_pick: i === enrichment.best_pick_index,
      }))
    : [];

  await query(
    `UPDATE leads
        SET first_touch_drafted_at = NOW(),
            first_touch_gmail_draft_id = $1,
            first_touch_subject = $2,
            first_touch_body = $3,
            first_touch_jd_source = $4,
            notes = $5,
            website_url = COALESCE($6, website_url),
            contacts = $7,
            enrichment_notes = $8,
            updated_at = NOW()
      WHERE id = $9`,
    [
      gmailDraft.draftId,
      drafted.subject,
      drafted.body,
      drafted.source.origin,
      newNotes,
      enrichment?.website_url ?? null,
      JSON.stringify(contactsJson),
      enrichment?.notes ?? null,
      numId,
    ],
  );

  const updated = await getLead(numId);
  const gmailUrl = `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`;

  return NextResponse.json({
    ok: true,
    analysis: drafted.analysis,
    subject: drafted.subject,
    body: drafted.body,
    /** In-memory roster — NOT persisted to prospect_contacts. Operator
     *  picks emails from this and POSTs them to /set-recipients which
     *  back-fills the existing Gmail draft. */
    roster: enrichment
      ? {
          website_url: enrichment.website_url,
          website_confidence: enrichment.website_confidence,
          scraped_pages: enrichment.scraped_pages,
          best_pick_reason: enrichment.best_pick_reason,
          notes: enrichment.notes,
          candidates: enrichment.candidates.map((c, i) => ({
            name: c.name,
            title: c.title,
            email: c.email,
            source_url: c.source_url,
            notes: c.notes,
            is_ai_top_pick: i === enrichment.best_pick_index,
          })),
        }
      : null,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl,
      sender: workspace.email,
    },
    source: drafted.source,
    lead: updated,
  });
}
