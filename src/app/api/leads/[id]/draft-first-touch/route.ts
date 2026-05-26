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
import { createGmailDraft, type GmailRecipient } from "@/lib/gmail/send";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { enrichCompany, type ContactCandidate } from "@/lib/ai/enrich-company";
import { createContact, listContacts, logActivity } from "@/lib/db/prospects";
import { query } from "@/lib/db/client";
import { ensureProspectForLead } from "@/lib/leads/promote";
import type { Lead } from "@/lib/leads-shared";
import type { ContactRole } from "@/lib/pipeline-shared";

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}

function mapTitleToRole(title: string | null): ContactRole {
  if (!title) return "other";
  const t = title.toLowerCase();
  if (/founder|ceo|president|owner|principal|managing partner/.test(t)) return "owner";
  if (/marketing|growth|brand|content|comms/.test(t)) return "marketing_lead";
  if (/creative|design|art director/.test(t)) return "designer";
  if (/cto|coo|cfo|vp |director|head of/.test(t)) return "decision_maker";
  return "other";
}

/** Build a "who should we reach" hint for the enricher based on the lead's posted role. */
function recipientContextFromLead(lead: Lead): string {
  const role = lead.source_title ?? "unspecified role";
  const business = lead.business_name ?? "the company";
  return `${business} is hiring for: "${role}". Find the people who would either be HIRING for this role (the function leader the new hire would report to) OR the company principal/founder/CEO if it's a small firm. For a marketing role, find the CMO / Marketing Director / Head of Marketing. For a design/creative role, find the Creative Director / Head of Design. If it's a small firm with no obvious function leader, the founder is the right call. Pick the SINGLE best primary contact + identify any complementary CC contacts (e.g., the founder if the function leader is the primary).`;
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

  // Auto-promote lead → prospect (if not already promoted and business_name present)
  const promotion = await ensureProspectForLead(lead, createdByLabel(auth));

  // Enrich the company → roster, BUT only if the prospect doesn't already
  // have contacts (idempotent — re-draft on a prospect doesn't re-enrich).
  // This happens BEFORE Gmail draft so we can populate TO/CC from the roster.
  let enrichment: Awaited<ReturnType<typeof enrichCompany>> | null = null;
  let toRecipients: GmailRecipient[] = [];
  const ccRecipients: GmailRecipient[] = [];
  let recipientGuess = guessRecipientEmail(drafted.raw_content_used);

  if (promotion.prospect_id > 0) {
    const existingContacts = await listContacts(promotion.prospect_id);
    if (existingContacts.length === 0) {
      try {
        enrichment = await enrichCompany({
          business_name: lead.business_name ?? promotion.prospect_name,
          source_url: lead.source_url,
          source_title: lead.source_title,
          recipient_context: recipientContextFromLead(lead),
        });
        // Persist candidates to prospect_contacts
        for (let i = 0; i < enrichment.candidates.length; i++) {
          const c = enrichment.candidates[i];
          await createContact({
            prospect_id: promotion.prospect_id,
            name: c.name,
            email: c.email,
            phone: null,
            role: mapTitleToRole(c.title),
            is_primary: i === enrichment.best_pick_index,
            notes: [c.title, c.notes, `Source: ${c.source_url}`]
              .filter(Boolean)
              .join(" — "),
          });
        }
      } catch (err) {
        console.warn("[draft-first-touch] enrichment failed", err);
      }
    }

    // Build TO/CC from contacts: primary as TO, all other emailed contacts as CC.
    const allContacts = await listContacts(promotion.prospect_id);
    const primary = allContacts.find((c) => c.is_primary && c.email);
    if (primary?.email) {
      toRecipients = [{ email: primary.email, name: primary.name }];
      recipientGuess = primary.email;
      for (const c of allContacts) {
        if (!c.email || c.id === primary.id) continue;
        ccRecipients.push({ email: c.email, name: c.name });
      }
    } else if (allContacts.some((c) => c.email)) {
      // No primary but we have emailed contacts — first emailed contact is TO
      const first = allContacts.find((c) => c.email)!;
      toRecipients = [{ email: first.email!, name: first.name }];
      recipientGuess = first.email!;
      for (const c of allContacts) {
        if (!c.email || c.id === first.id) continue;
        ccRecipients.push({ email: c.email, name: c.name });
      }
    }
  }

  let gmailDraft;
  try {
    gmailDraft = await createGmailDraft({
      to: toRecipients[0]?.email ?? "",
      toName: toRecipients[0]?.name ?? null,
      tos: toRecipients.slice(1),
      cc: ccRecipients,
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

  // Re-list contacts so the response reflects the final state (incl. enrichment).
  const finalContacts = promotion.prospect_id > 0
    ? await listContacts(promotion.prospect_id)
    : [];

  return NextResponse.json({
    ok: true,
    analysis: drafted.analysis,
    subject: drafted.subject,
    body: drafted.body,
    recipient_guess: recipientGuess,
    recipients: {
      to: toRecipients,
      cc: ccRecipients,
    },
    contacts: finalContacts,
    enrichment: enrichment
      ? {
          website_url: enrichment.website_url,
          website_confidence: enrichment.website_confidence,
          scraped_pages: enrichment.scraped_pages,
          failed_pages: enrichment.failed_pages,
          best_pick_reason: enrichment.best_pick_reason,
          notes: enrichment.notes,
        }
      : null,
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
          was_already_converted: promotion.was_already_converted,
          name: promotion.prospect_name,
          url: `/pipeline/${promotion.prospect_id}`,
        }
      : null,
  });
}
