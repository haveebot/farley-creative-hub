/**
 * POST /api/leads/[id]/draft-first-touch
 *
 * Two-input single-action: takes the operator's selected recipient
 * emails + the lead context, drafts the email via Claude, creates the
 * Gmail draft with those recipients ALREADY on the To: line. No
 * second back-fill step.
 *
 * Pair with /populate-roster which is the prerequisite roster step.
 * Operator picks recipients on the lead detail UI from the roster
 * (lead.contacts), then hits Draft. UI passes the selected emails.
 *
 * Optionally persists operator email edits back to lead.contacts when
 * the `contacts` field is passed in the request body.
 *
 * Does NOT promote the lead to a prospect. Operator does that
 * separately via the existing Convert button after the email has
 * actually been sent.
 *
 * Request body:
 *   {
 *     recipients: Array<{ email: string, name?: string }>,
 *     contacts?: LeadContact[],   // optional — persist roster edits
 *     operator_pasted?: string,    // optional — full JD if URL+stored thin
 *   }
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { getStudioKit } from "@/lib/db/brand-kits";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import {
  createGmailDraft,
  deleteGmailDraft,
  type GmailRecipient,
} from "@/lib/gmail/send";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { query } from "@/lib/db/client";

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

  let body: {
    recipients?: Array<{ email?: string; name?: string }>;
    contacts?: Array<{
      name: string;
      title?: string | null;
      email?: string | null;
      source_url?: string;
      notes?: string | null;
      is_ai_top_pick?: boolean;
    }>;
    operator_pasted?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const recipients: GmailRecipient[] = Array.isArray(body.recipients)
    ? body.recipients
        .filter((r): r is { email: string; name?: string } => !!r?.email?.trim())
        .map((r) => ({ email: r.email.trim(), name: r.name ?? null }))
    : [];

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-recipients",
        message:
          "Pick at least one recipient from the roster before drafting. (Run Populate roster first if you haven't.)",
      },
      { status: 400 },
    );
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
      { ok: false, error: "draft-failed", message: (err as Error).message },
      { status: 400 },
    );
  }

  // If a previous draft exists for this lead, delete it before creating
  // the new one. Only one live first-touch draft per lead.
  if (lead.first_touch_gmail_draft_id) {
    try {
      await deleteGmailDraft(lead.first_touch_gmail_draft_id);
    } catch (err) {
      console.warn("[draft-first-touch] previous draft delete failed (continuing)", err);
    }
  }

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: recipients[0].email,
      toName: recipients[0].name ?? null,
      tos: recipients.slice(1),
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

  // Persist: lead.first_touch_* + (if provided) operator's contact edits
  const noteLine = `[first-touch drafted ${new Date().toISOString().slice(0, 10)}] ${drafted.subject} (${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}; gmail draft ${gmailDraft.draftId})`;
  const newNotes = lead.notes.trim()
    ? `${lead.notes.trim()}\n\n${noteLine}`
    : noteLine;

  if (Array.isArray(body.contacts)) {
    const normalizedContacts = body.contacts
      .filter((c) => c && typeof c.name === "string")
      .map((c) => ({
        name: c.name,
        title: c.title ?? null,
        email: c.email ?? null,
        source_url: c.source_url ?? "",
        notes: c.notes ?? null,
        is_ai_top_pick: !!c.is_ai_top_pick,
      }));
    await query(
      `UPDATE leads
          SET first_touch_drafted_at = NOW(),
              first_touch_gmail_draft_id = $1,
              first_touch_subject = $2,
              first_touch_body = $3,
              first_touch_jd_source = $4,
              notes = $5,
              contacts = $6,
              updated_at = NOW()
        WHERE id = $7`,
      [
        gmailDraft.draftId,
        drafted.subject,
        drafted.body,
        drafted.source.origin,
        newNotes,
        JSON.stringify(normalizedContacts),
        numId,
      ],
    );
  } else {
    await query(
      `UPDATE leads
          SET first_touch_drafted_at = NOW(),
              first_touch_gmail_draft_id = $1,
              first_touch_subject = $2,
              first_touch_body = $3,
              first_touch_jd_source = $4,
              notes = $5,
              updated_at = NOW()
        WHERE id = $6`,
      [
        gmailDraft.draftId,
        drafted.subject,
        drafted.body,
        drafted.source.origin,
        newNotes,
        numId,
      ],
    );
  }

  const updated = await getLead(numId);
  const gmailUrl = `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`;

  return NextResponse.json({
    ok: true,
    analysis: drafted.analysis,
    subject: drafted.subject,
    body: drafted.body,
    recipients,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl,
      sender: workspace.email,
    },
    source: drafted.source,
    lead: updated,
  });
}
