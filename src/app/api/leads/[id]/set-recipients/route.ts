/**
 * POST /api/leads/[id]/set-recipients
 *
 * Back-fill recipient emails into the existing Gmail draft for this
 * lead. Deletes the existing draft + creates a new one with the chosen
 * TO list and the same subject + body.
 *
 * Lead is NOT promoted. Contacts are NOT persisted — the roster lives
 * in-memory in the operator's UI session. Operator only commits the
 * emails they actually want on the To: line.
 *
 * Request body:
 *   {
 *     recipients: Array<{ email: string, name?: string }>,
 *     subject: string,
 *     body: string,
 *   }
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
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
  if (!lead.first_touch_gmail_draft_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-draft",
        message: "Draft first-touch first; this endpoint back-fills recipients into an existing draft.",
      },
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
    recipients?: Array<{ email?: string; name?: string }>;
    subject?: string;
    body?: string;
    /** Optional: full contacts list to persist back to lead.contacts.
     *  When provided, operator edits to emails get saved. */
    contacts?: Array<{
      name: string;
      title?: string | null;
      email?: string | null;
      source_url?: string;
      notes?: string | null;
      is_ai_top_pick?: boolean;
    }>;
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
        message: "At least one recipient required.",
      },
      { status: 400 },
    );
  }

  // Delete the old draft, create a new one with the picked recipients on TO.
  try {
    await deleteGmailDraft(lead.first_touch_gmail_draft_id);
  } catch (err) {
    console.warn("[set-recipients] previous draft delete failed (continuing)", err);
  }

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: recipients[0].email,
      toName: recipients[0].name ?? null,
      tos: recipients.slice(1),
      subject,
      text: emailBody,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "gmail-create-failed", message: (err as Error).message },
      { status: 502 },
    );
  }

  // If operator edited the contacts list inline, persist it back so the
  // emails stick across refreshes / machines.
  if (Array.isArray(body.contacts)) {
    const normalized = body.contacts
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
      `UPDATE leads SET first_touch_gmail_draft_id = $1, contacts = $2, updated_at = NOW() WHERE id = $3`,
      [gmailDraft.draftId, JSON.stringify(normalized), numId],
    );
  } else {
    await query(
      `UPDATE leads SET first_touch_gmail_draft_id = $1, updated_at = NOW() WHERE id = $2`,
      [gmailDraft.draftId, numId],
    );
  }

  return NextResponse.json({
    ok: true,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl: `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`,
      sender: workspace.email,
    },
    recipients,
  });
}
