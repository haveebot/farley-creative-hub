/**
 * Site pageviews — Hub-owned web analytics replacing the failed
 * Vercel Analytics API integration (that endpoint never existed publicly).
 *
 * Insert path: POST /api/track from the farleycreative.com Tracker
 *   component. Public + CORS-allowlisted. Privacy-preserving — only
 *   stores path, referrer host, country code, and a daily-rotating
 *   visitor hash. No PII, no IP, no UA.
 *
 * Read path: GET /api/web-analytics?period=… on the Hub home card.
 *   Aggregates per-period totals, top paths, top referrers, countries.
 *
 * Multi-tenant ready: every row carries a site_id so future tenant
 * sites can drop the same tracker in and get their own card for free.
 */

import { query } from "./client";

// ============ Insert ============

export type PageviewInsert = {
  site_id: string;
  path: string;
  referrer: string | null;
  country: string | null;
  visitor_id: string;
};

export async function recordPageview(input: PageviewInsert): Promise<void> {
  await query(
    `INSERT INTO site_pageviews (site_id, path, referrer, country, visitor_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.site_id, input.path, input.referrer, input.country, input.visitor_id],
  );
}

// ============ Read / aggregate ============

export type Period = "24h" | "7d" | "30d" | "90d";

const PERIOD_MS: Record<Period, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export type AnalyticsSummary = {
  period: Period;
  total_views: number;
  total_visitors: number;
  top_paths: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
  fetched_at: string;
};

export async function getSiteAnalytics(
  site_id: string,
  period: Period = "7d",
): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - PERIOD_MS[period]).toISOString();

  const [totals, paths, refs, countries] = await Promise.all([
    query<{ views: string; visitors: string }>(
      `SELECT COUNT(*)::text AS views,
              COUNT(DISTINCT visitor_id)::text AS visitors
         FROM site_pageviews
         WHERE site_id = $1 AND created_at >= $2`,
      [site_id, since],
    ),
    query<{ path: string; views: string }>(
      `SELECT path, COUNT(*)::text AS views
         FROM site_pageviews
         WHERE site_id = $1 AND created_at >= $2
         GROUP BY path
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
      [site_id, since],
    ),
    query<{ referrer: string; views: string }>(
      `SELECT COALESCE(referrer, '(direct)') AS referrer,
              COUNT(*)::text AS views
         FROM site_pageviews
         WHERE site_id = $1 AND created_at >= $2
         GROUP BY COALESCE(referrer, '(direct)')
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
      [site_id, since],
    ),
    query<{ country: string; views: string }>(
      `SELECT country, COUNT(*)::text AS views
         FROM site_pageviews
         WHERE site_id = $1 AND created_at >= $2 AND country IS NOT NULL
         GROUP BY country
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
      [site_id, since],
    ),
  ]);

  return {
    period,
    total_views: Number(totals[0]?.views ?? 0),
    total_visitors: Number(totals[0]?.visitors ?? 0),
    top_paths: paths.map((r) => ({ path: r.path, views: Number(r.views) })),
    top_referrers: refs.map((r) => ({
      referrer: r.referrer ?? "(direct)",
      views: Number(r.views),
    })),
    countries: countries.map((r) => ({
      country: r.country,
      views: Number(r.views),
    })),
    fetched_at: new Date().toISOString(),
  };
}
