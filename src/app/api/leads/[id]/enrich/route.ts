/**
 * POST /api/leads/[id]/enrich
 *
 * Operator-paste-and-enrich: takes the full posting body (pasted by
 * the operator from the source URL, since most sources block server
 * fetches) and re-runs the AI parser against it. Updates the lead with
 * the richer parsed fields without clobbering operator-edited values.
 *
 * Body:
 *   { text: string }   — the full posting body
 *
 * Returns the updated lead.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { parseLead } from "@/lib/ai/parse-lead";
import { getLead, updateLead, type LeadUpdate } from "@/lib/db/leads";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  SERVICE_INTERESTS,
} from "@/lib/pipeline-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (text.length < 100) {
    return NextResponse.json(
      {
        ok: false,
        error: "text-too-short",
        message: "Paste at least ~100 chars of the source posting body.",
      },
      { status: 400 },
    );
  }

  const lead = await getLead(numId);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = await parseLead(text);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "parse-failed", message: (err as Error).message },
      { status: 502 },
    );
  }

  // Build updates: always replace raw_content (the whole point), and
  // backfill structured fields only when the existing one is empty (so
  // we don't clobber operator-edited values).
  const updates: LeadUpdate = {
    raw_content: parsed.raw_content || text,
  };
  if (!lead.business_name && parsed.business_name) {
    updates.business_name = parsed.business_name;
  }
  if (!lead.source_title && parsed.source_title) {
    updates.source_title = parsed.source_title;
  }
  if (!lead.source_url && parsed.source_url) {
    updates.source_url = parsed.source_url;
  }
  if (!lead.city && parsed.city) updates.city = parsed.city;
  if (!lead.state && parsed.state) updates.state = parsed.state;
  if (
    !lead.industry &&
    parsed.industry &&
    (PROSPECT_INDUSTRIES as string[]).includes(parsed.industry)
  ) {
    updates.industry = parsed.industry;
  }
  if (
    !lead.size &&
    parsed.size &&
    (PROSPECT_SIZES as string[]).includes(parsed.size)
  ) {
    updates.size = parsed.size;
  }
  // Merge service_signal — union of existing + parsed (don't lose ones operator added)
  if (Array.isArray(parsed.service_signal) && parsed.service_signal.length > 0) {
    const allowed = new Set(SERVICE_INTERESTS as readonly string[]);
    const merged = Array.from(
      new Set([
        ...lead.service_signal,
        ...parsed.service_signal.filter((s): s is string => typeof s === "string" && allowed.has(s)),
      ]),
    );
    updates.service_signal = merged;
  }

  const updated = await updateLead(numId, updates);

  return NextResponse.json({
    ok: true,
    lead: updated,
    enriched: {
      raw_content_added: parsed.raw_content?.length ?? text.length,
      fields_backfilled: Object.keys(updates).filter((k) => k !== "raw_content"),
    },
  });
}
