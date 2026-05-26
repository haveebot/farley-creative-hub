/**
 * POST /api/leads/[id]/send-to-gmail — COMMIT step of first-touch flow.
 *
 * The pair to /draft-first-touch (the PREPARE step). After the operator
 * sees the roster + draft preview and picks which recipients to include,
 * this endpoint creates the Gmail draft with all of them on the TO line
 * (Sage multi-TO pattern — no CC). If a previous draft exists for the
 * lead, deletes it first so there's only one live first-touch draft per
 * lead.
 *
 * Also handles the first_touch_* lead tracking + activity log here (was
 * previously on prepare; moved here so the lead row only stamps once a
 * Gmail draft actually exists).
 *
 * Request body:
 *   {
 *     contact_ids: number[],  // contacts to include on the TO line
 *     subject: string,
 *     body: string,
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     gmail: { draftId, gmailUrl, sender },
 *     recipients: { to: GmailRecipient[] },
 *   }
 */
import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { listContacts, logActivity } from "@/lib/db/prospects";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import {
  createGmailDraft,
  deleteGmailDraft,
  type GmailRecipient,
} from "@/lib/gmail/send";
import { query } from "@/lib/db/client";

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
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
  if (!lead.converted_to_prospect_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "not-promoted",
        message: "Lead must be promoted to a prospect first — run draft-first-touch (prepare) before send-to-gmail (commit).",
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
    contact_ids?: number[];
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

  const toList: GmailRecipient[] = Array.isArray(body.contact_ids)
    ? body.contact_ids
        .map((cid) => byId.get(cid))
        .filter((c): c is NonNullable<typeof c> => !!c && !!c.email)
        .map((c) => ({ email: c.email!, name: c.name }))
    : [];

  if (toList.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-recipients",
        message: "At least one recipient with an email required.",
      },
      { status: 400 },
    );
  }

  // Delete the existing draft (best-effort) before creating the new one,
  // so there's only ever ONE first-touch draft live per lead.
  if (lead.first_touch_gmail_draft_id) {
    try {
      await deleteGmailDraft(lead.first_touch_gmail_draft_id);
    } catch (err) {
      console.warn("[send-to-gmail] previous draft delete failed (continuing)", err);
    }
  }

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: toList[0].email,
      toName: toList[0].name ?? null,
      tos: toList.slice(1),
      subject,
      text: emailBody,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "gmail-create-failed", message: (err as Error).message },
      { status: 502 },
    );
  }

  // Stamp the lead row + activity log now that a draft actually exists.
  const noteLine = `[first-touch drafted ${new Date().toISOString().slice(0, 10)}] ${subject} (gmail draft ${gmailDraft.draftId}; ${toList.length} recipient${toList.length !== 1 ? "s" : ""})`;
  const newNotes = lead.notes.trim()
    ? `${lead.notes.trim()}\n\n${noteLine}`
    : noteLine;

  await query(
    `UPDATE leads
        SET first_touch_drafted_at = NOW(),
            first_touch_gmail_draft_id = $1,
            first_touch_subject = $2,
            notes = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [gmailDraft.draftId, subject, newNotes, numId],
  );

  await logActivity({
    prospect_id: lead.converted_to_prospect_id,
    kind: "email_drafted",
    content: `First-touch: ${subject} — ${toList.length} recipient${toList.length !== 1 ? "s" : ""} (review in Gmail Drafts)`,
    draft_id: null,
    created_by: createdByLabel(auth),
  }).catch((err) =>
    console.warn("[send-to-gmail] email_drafted activity log failed", err),
  );

  return NextResponse.json({
    ok: true,
    gmail: {
      draftId: gmailDraft.draftId,
      gmailUrl: `https://mail.google.com/mail/u/${encodeURIComponent(workspace.email)}/#drafts?compose=${gmailDraft.draftId}`,
      sender: workspace.email,
    },
    recipients: { to: toList },
  });
}
