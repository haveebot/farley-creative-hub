/**
 * POST /api/leads/[id]/update-draft-recipients
 *
 * Operator curator action. After first-touch draft lands, the operator
 * may want to change who's on TO / CC (add a founder, drop an unrelated
 * contact, etc.). This endpoint:
 *   1. Validates the contact IDs belong to the lead's prospect
 *   2. Deletes the existing Gmail draft
 *   3. Creates a new Gmail draft with the new TO + CC + same body
 *   4. Updates lead.first_touch_gmail_draft_id to the new id
 *   5. Returns the new draft + gmail URL
 *
 * The email body + subject are preserved as-is from the existing draft —
 * we don't re-run Claude (operator's edits to the draft body in Gmail
 * would be lost otherwise). If operator wants a fresh draft they hit
 * Re-draft first-touch on the lead page.
 *
 * Request body:
 *   { to_contact_ids: number[], cc_contact_ids: number[], subject: string, body: string }
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { listContacts } from "@/lib/db/prospects";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import {
  createGmailDraft,
  deleteGmailDraft,
  type GmailRecipient,
} from "@/lib/gmail/send";
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
  if (!lead.converted_to_prospect_id) {
    return NextResponse.json(
      { ok: false, error: "not-promoted", message: "Lead must be promoted to a prospect first." },
      { status: 400 },
    );
  }

  const workspace = await getConnectionByPurpose("sending");
  if (!workspace) {
    return NextResponse.json(
      { ok: false, error: "no-workspace" },
      { status: 400 },
    );
  }

  let body: {
    to_contact_ids?: number[];
    cc_contact_ids?: number[];
    subject?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-body" }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim();
  const emailBody = (body.body ?? "").trim();
  if (!subject || !emailBody) {
    return NextResponse.json(
      { ok: false, error: "missing-content", message: "subject + body required" },
      { status: 400 },
    );
  }

  const allContacts = await listContacts(lead.converted_to_prospect_id);
  const byId = new Map(allContacts.map((c) => [c.id, c]));

  function resolve(ids: number[] | undefined): GmailRecipient[] {
    if (!Array.isArray(ids)) return [];
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c && !!c.email)
      .map((c) => ({ email: c.email!, name: c.name }));
  }

  const toList = resolve(body.to_contact_ids);
  const ccList = resolve(body.cc_contact_ids);

  if (toList.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no-recipients", message: "At least one TO recipient required" },
      { status: 400 },
    );
  }

  // Delete the existing draft (best-effort) before creating the new one.
  if (lead.first_touch_gmail_draft_id) {
    try {
      await deleteGmailDraft(lead.first_touch_gmail_draft_id);
    } catch (err) {
      console.warn("[update-draft-recipients] delete failed (continuing)", err);
    }
  }

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: toList[0].email,
      toName: toList[0].name ?? null,
      tos: toList.slice(1),
      cc: ccList,
      subject,
      text: emailBody,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "gmail-create-failed", message: (err as Error).message },
      { status: 502 },
    );
  }

  await query(
    `UPDATE leads SET first_touch_gmail_draft_id = $1, first_touch_subject = $2, updated_at = NOW() WHERE id = $3`,
    [gmailDraft.draftId, subject, numId],
  );

  return NextResponse.json({
    ok: true,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl: `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`,
      sender: workspace.email,
    },
    recipients: { to: toList, cc: ccList },
  });
}
