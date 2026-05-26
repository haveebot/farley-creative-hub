/**
 * Vercel Web Analytics fetcher.
 *
 * Queries the Vercel API for page-view metrics on the farley-creative-site
 * project. Used by the Hub's web-traffic dashboard card.
 *
 * Env vars:
 *   VERCEL_API_TOKEN — Vercel personal access token with project read access
 *   FARLEY_SITE_PROJECT_ID — Vercel project id (e.g. prj_xLcNfmszcxk2I53WCnCB7c3wMdQ2)
 *   VERCEL_TEAM_ID — Vercel team id (e.g. team_FSrdGWGTr9KzK4hrFp0ArtOF)
 *
 * If any of these are missing, queries return null and the dashboard
 * card surfaces a "not configured" hint.
 */

const VERCEL_API_BASE = "https://vercel.com/api";

type Period = "24h" | "7d" | "30d" | "90d";

const PERIOD_MS: Record<Period, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export type WebAnalyticsSummary = {
  period: Period;
  total_views: number;
  total_visitors: number;
  top_paths: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
  fetched_at: string;
};

type FetchOpts = { period?: Period };

export async function fetchSiteAnalytics(
  opts: FetchOpts = {},
): Promise<WebAnalyticsSummary | null> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.FARLEY_SITE_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId || !teamId) return null;

  const period = opts.period ?? "7d";
  const now = Date.now();
  const from = now - PERIOD_MS[period];

  async function call(type: string, limit = 10): Promise<unknown> {
    const url = new URL(`${VERCEL_API_BASE}/web/insights/${type}`);
    url.searchParams.set("projectId", projectId!);
    url.searchParams.set("teamId", teamId!);
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(now));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("environment", "production");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      // Avoid Next caching this — analytics should be near-real-time
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[vercel-analytics] ${type} → ${res.status}`);
      return null;
    }
    return res.json();
  }

  // Vercel returns different shapes per type; we normalize here.
  type ViewsResp = { data?: Array<{ key: string; total: number; devices?: number }>; total?: number; devices?: number };
  type PathsResp = { data?: Array<{ key: string; total: number }> };

  const [viewsRaw, pathsRaw, referrersRaw, countriesRaw] = await Promise.all([
    call("views") as Promise<ViewsResp | null>,
    call("paths") as Promise<PathsResp | null>,
    call("referrers") as Promise<PathsResp | null>,
    call("countries") as Promise<PathsResp | null>,
  ]);

  const total_views = sumViews(viewsRaw);
  const total_visitors = sumVisitors(viewsRaw);

  return {
    period,
    total_views,
    total_visitors,
    top_paths: (pathsRaw?.data ?? []).slice(0, 5).map((r) => ({ path: r.key, views: r.total })),
    top_referrers: (referrersRaw?.data ?? []).slice(0, 5).map((r) => ({ referrer: r.key, views: r.total })),
    countries: (countriesRaw?.data ?? []).slice(0, 5).map((r) => ({ country: r.key, views: r.total })),
    fetched_at: new Date().toISOString(),
  };
}

function sumViews(r: { data?: Array<{ total: number }>; total?: number } | null): number {
  if (!r) return 0;
  if (typeof r.total === "number") return r.total;
  return (r.data ?? []).reduce((acc, x) => acc + (x.total ?? 0), 0);
}

function sumVisitors(r: { data?: Array<{ devices?: number }>; devices?: number } | null): number {
  if (!r) return 0;
  if (typeof r.devices === "number") return r.devices;
  return (r.data ?? []).reduce((acc, x) => acc + (x.devices ?? 0), 0);
}
