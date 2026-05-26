/**
 * GET /api/web-analytics?period=7d
 *
 * Auth-gated (operator session). Returns farleycreative.com web traffic
 * summary from Vercel Analytics.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { fetchSiteAnalytics } from "@/lib/vercel/web-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period =
    periodParam === "24h" || periodParam === "30d" || periodParam === "90d"
      ? periodParam
      : "7d";

  try {
    const summary = await fetchSiteAnalytics({ period });
    if (!summary) {
      return NextResponse.json(
        {
          ok: false,
          error: "not-configured",
          message:
            "Web analytics requires VERCEL_API_TOKEN + FARLEY_SITE_PROJECT_ID + VERCEL_TEAM_ID env vars on the Hub project.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "fetch-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
