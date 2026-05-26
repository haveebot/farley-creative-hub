/**
 * POST /api/leads/[id]/draft-first-touch
 *
 * SIMPLE single-action: AI drafts an email tailored to the JD, lands it
 * in the connected Workspace Gmail Drafts folder. That's it.
 *
 * What this endpoint does NOT do:
 *   - Does NOT auto-promote the lead to a prospect (operator does that
 *     manually via the existing Convert button once they actually send
 *     the email — drafting is not contacting).
 *   - Does NOT enrich the company or build a roster (that's a separate
 *     concern that belongs on the prospect side, not pre-contact).
 *   - Does NOT pick recipients from a roster (operator fills in the To:
 *     field in Gmail before sending — best-effort guess from the JD if
 *     a literal email address is visible there).
 *
 * Flow:
 *   1. Resolve JD content via hybrid fetch (URL → stored → operator paste)
 *   2. Draft email via Claude (composition template + brand kit + voice)
 *   3. Best-effort regex-extract a recipient email from the JD (skipped
 *      if no email is in the JD or if it's a noreply address)
 *   4. Create the Gmail draft
 *   5. Stamp lead.first_touch_* tracking columns
 *   6. Return the Gmail draft link + email preview
 *
 * Request body (optional):
 *   { operator_pasted?: string }  — full JD text if URL + stored are thin
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { getStudioKit } from "@/lib/db/brand-kits";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import { createGmailDraft } from "@/lib/gmail/send";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { query } from "@/lib/db/client";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function guessRecipientEmail(jd: string): string | null {
  const match = jd.match(EMAIL_RE);
  if (!match) return null;
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
      { ok: false, error: "draft-failed", message: (err as Error).message },
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
        analysis: drafted.analysis,
        subject: drafted.subject,
        body: drafted.body,
      },
      { status: 502 },
    );
  }

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

  const updated = await getLead(numId);
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
    lead: updated,
  });
}
