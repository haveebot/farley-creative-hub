/**
 * GET /api/web-analytics?period=7d
 *
 * Auth-gated (operator session). Returns farleycreative.com web traffic
 * summary from the Hub's own site_pageviews table (populated by the
 * <Tracker /> component on farleycreative.com via POST /api/track).
 *
 * Replaces the prior Vercel Web Analytics API integration (commit
 * f366b29 era) — that endpoint base URL never existed publicly, the
 * fetcher silently returned zeros. Hub-owned analytics avoids the
 * dependency and matches the "operating system" thesis.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getSiteAnalytics, type Period } from "@/lib/db/pageviews";

export const dynamic = "force-dynamic";

const VALID_PERIODS: ReadonlySet<Period> = new Set([
  "24h",
  "7d",
  "30d",
  "90d",
]);

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: Period =
    periodParam && VALID_PERIODS.has(periodParam as Period)
      ? (periodParam as Period)
      : "7d";
  const site_id = url.searchParams.get("site_id") || "farleycreative.com";

  try {
    const summary = await getSiteAnalytics(site_id, period);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "fetch-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
