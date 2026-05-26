/**
 * POST /api/leads/[id]/draft-first-touch — PREPARE step.
 *
 * Sage-style multi-TO outreach pattern. Per the Sage Agency Intro Email
 * Playbook ("Send to principals + sales manager + specs contact
 * simultaneously"), the first-touch flow is two clicks:
 *   1. PREPARE (this endpoint) — enrich company → roster → draft email
 *      in memory. NO Gmail draft yet. Returns roster + email preview.
 *   2. COMMIT (POST /api/leads/[id]/send-to-gmail) — with the operator's
 *      chosen recipient list, creates ONE Gmail draft with all chosen
 *      contacts on the TO line.
 *
 * This endpoint does:
 *   1. Auto-promote lead → prospect (idempotent)
 *   2. Enrich company → populate prospect_contacts (idempotent — skips
 *      if contacts already exist)
 *   3. Resolve JD content via hybrid fetch (URL → stored → operator paste)
 *   4. Draft email via Claude (composition template + brand kit + voice
 *      profile)
 *   5. Return roster + recipients (AI's pre-selected picks, all with
 *      email default to "included") + email preview
 *
 * No Gmail draft is created at this step. No lead row first_touch_*
 * columns are stamped yet — that happens on commit.
 *
 * Request body (optional):
 *   { operator_pasted?: string }  — full JD text if URL + stored are thin
 */
import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { getStudioKit } from "@/lib/db/brand-kits";
import { getDefaultVoiceProfile } from "@/lib/db/voice-profiles";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";
import { draftFirstTouch } from "@/lib/ai/first-touch";
import { enrichCompany } from "@/lib/ai/enrich-company";
import { createContact, listContacts } from "@/lib/db/prospects";
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

/** Build a "who should we reach" hint for the enricher.
 *  Sage pattern: send to principals + function-leader + specs simultaneously,
 *  not just one person. Enricher should surface all of them. */
function recipientContextFromLead(lead: Lead): string {
  const role = lead.source_title ?? "unspecified role";
  const business = lead.business_name ?? "the company";
  return `${business} is hiring for: "${role}". This outreach goes to MULTIPLE recipients in one email (Sage pattern: principals + function leader + relevant peers simultaneously). Surface ALL leadership-level contacts you can find: the principal/founder/CEO, the function leader the new hire would report to (e.g., CMO for a Marketing Director hire, Creative Director for a Design role), and any other senior leaders who'd care about this hire. The operator will pick which subset of these to include on the email's TO line.`;
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
  // have contacts (idempotent — re-prepare on a prospect doesn't re-enrich).
  let enrichment: Awaited<ReturnType<typeof enrichCompany>> | null = null;

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
  }

  // Default "include" suggestion (operator can override on the UI):
  // Sage pattern — include ALL emailed contacts on the TO line. Operator
  // unchecks anyone they want to skip before committing to Gmail.
  const finalContacts = promotion.prospect_id > 0
    ? await listContacts(promotion.prospect_id)
    : [];
  const suggested_to_contact_ids = finalContacts
    .filter((c) => c.email)
    .map((c) => c.id);

  return NextResponse.json({
    ok: true,
    analysis: drafted.analysis,
    subject: drafted.subject,
    body: drafted.body,
    contacts: finalContacts,
    /** Operator-overridable suggestion: include all emailed contacts on the TO line. */
    suggested_to_contact_ids,
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
    source: drafted.source,
    lead,
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
