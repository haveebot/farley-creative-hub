/**
 * POST /api/admin/leads-backfill
 *
 * One-shot backfill endpoint: searches the connected reading_leads
 * Gmail inbox for messages matching a query, applies the `Hub/Leads`
 * label to each. Idempotent — already-labeled messages are detected
 * via the same query (already-labeled messages can be re-labeled
 * harmlessly; Gmail accepts it).
 *
 * After backfill, the regular cron tick (/api/cron/lead-poll) picks up
 * the now-labeled messages and parses them into lead rows.
 *
 * Request body:
 *   {
 *     "q": "from:(noreply@indeed.com OR alerts@angellist.com)",
 *     "limit": 100,           // optional, default 100, max 200
 *     "dry_run": false        // optional, if true returns matched count without labeling
 *   }
 *
 * Requires user-session auth (operator-only). Not a cron endpoint.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  addLabel,
  ensureLabel,
  searchMessages,
} from "@/lib/gmail/read";
import { getConnectionByPurpose } from "@/lib/db/workspace-connections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEAD_LABEL = "Hub/Leads";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const connection = await getConnectionByPurpose("reading_leads");
  if (!connection) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-reading-leads-connection",
        detail:
          "Connect the 'Lead source' Workspace slot at /settings/workspace first.",
      },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-body" },
      { status: 400 },
    );
  }

  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) {
    return NextResponse.json(
      {
        ok: false,
        error: "q-required",
        detail:
          'Pass a Gmail search query, e.g. q: "from:(noreply@indeed.com OR alerts@angellist.com)"',
      },
      { status: 400 },
    );
  }

  const limit = Math.min(
    typeof body.limit === "number" && body.limit > 0 ? body.limit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const dryRun = body.dry_run === true;

  let matches;
  try {
    matches = await searchMessages(q, limit, "reading_leads");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "search-failed", detail: (err as Error).message },
      { status: 500 },
    );
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      query: q,
      workspace_email: connection.email,
      matched: matches.length,
      detail:
        matches.length === 0
          ? "No matching messages found. Check the query syntax."
          : `Would label ${matches.length} message(s). Re-run with dry_run:false to apply.`,
    });
  }

  const label = await ensureLabel(LEAD_LABEL, "reading_leads");

  let labeledCount = 0;
  const errors: Array<{ message_id: string; error: string }> = [];

  for (const m of matches) {
    try {
      await addLabel(m.id, label.id, "reading_leads");
      labeledCount++;
    } catch (err) {
      errors.push({ message_id: m.id, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    workspace_email: connection.email,
    label: LEAD_LABEL,
    query: q,
    matched: matches.length,
    labeled: labeledCount,
    errors,
    next_step:
      labeledCount > 0
        ? "Labeled messages will be processed at the next /api/cron/lead-poll tick (within 30 min). Or trigger the cron manually to process now."
        : "No messages were labeled. Check the dry_run preview to debug the query.",
  });
}
