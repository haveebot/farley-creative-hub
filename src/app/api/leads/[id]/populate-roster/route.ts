/**
 * POST /api/leads/[id]/populate-roster
 *
 * Roster-only step. Runs enrichment (company website + contact-page
 * crawl + Claude extraction of name/title/email), persists results to
 * lead.website_url + lead.contacts. Does NOT touch Gmail, does NOT
 * draft an email, does NOT promote the lead.
 *
 * Operator decides: "I want to research this company." After roster
 * loads they pick recipients + manually add any missing emails, THEN
 * hit Draft first-touch — which creates the Gmail draft with the
 * selected recipients already on the To: line (no back-fill step).
 *
 * Idempotent. Re-running replaces lead.contacts with the fresh
 * enrichment (operator edits will be lost — but they wouldn't normally
 * re-populate if they'd already curated).
 *
 * Request body: {}  (no parameters)
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getLead } from "@/lib/db/leads";
import { enrichCompany } from "@/lib/ai/enrich-company";
import { query } from "@/lib/db/client";
import type { Lead } from "@/lib/leads-shared";

function recipientContextFromLead(lead: Lead): string {
  const role = lead.source_title ?? "unspecified role";
  const business = lead.business_name ?? "the company";
  return `${business} is hiring for: "${role}". This outreach is one email to multiple recipients on the TO line (Sage pattern). Surface ALL leadership-level contacts: principal/founder/CEO, the function leader the new hire would report to, and any other senior leaders. Operator picks which to include.`;
}

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
  if (!lead.business_name?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-business-name",
        message:
          "Add a business name to the lead before populating roster — enrichment needs it to find the company website.",
      },
      { status: 400 },
    );
  }

  let enrichment;
  try {
    enrichment = await enrichCompany({
      business_name: lead.business_name,
      website_url: lead.website_url, // skip URL-guess if operator already set one
      source_url: lead.source_url,
      source_title: lead.source_title,
      recipient_context: recipientContextFromLead(lead),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "enrichment-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  const contactsJson = enrichment.candidates.map((c, i) => ({
    name: c.name,
    title: c.title,
    email: c.email,
    source_url: c.source_url,
    notes: c.notes,
    is_ai_top_pick: i === enrichment.best_pick_index,
  }));

  await query(
    `UPDATE leads
        SET website_url = COALESCE($1, website_url),
            contacts = $2,
            enrichment_notes = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [
      enrichment.website_url,
      JSON.stringify(contactsJson),
      enrichment.notes,
      numId,
    ],
  );

  const updated = await getLead(numId);

  return NextResponse.json({
    ok: true,
    lead: updated,
    enrichment: {
      website_url: enrichment.website_url,
      website_confidence: enrichment.website_confidence,
      scraped_pages: enrichment.scraped_pages,
      failed_pages: enrichment.failed_pages,
      best_pick_reason: enrichment.best_pick_reason,
      notes: enrichment.notes,
      contacts_total: enrichment.candidates.length,
      contacts_with_emails: enrichment.candidates.filter((c) => c.email).length,
    },
  });
}
