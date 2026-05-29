/**
 * POST /api/track  — public pageview ingestion from tenant sites.
 *
 * Called by the <Tracker /> component on farleycreative.com (and any
 * future tenant site) on every page navigation. Fire-and-forget.
 *
 * Privacy: stores only path, normalized referrer host, country code,
 * and a daily-rotating visitor hash. No raw IP, no raw UA, no PII.
 *
 * CORS: allowlisted by origin (farleycreative.com + www). OPTIONS
 * preflight supported.
 *
 * Auth: none. Public endpoint by design. Spam/bot filtering is the
 * only guard.
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { recordPageview } from "@/lib/db/pageviews";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "https://farleycreative.com",
  "https://www.farleycreative.com",
  // Vercel preview deployments for the site
  // (allow any *.vercel.app preview that pings — low spam risk, useful for QA)
]);

const BOT_RE =
  /bot|crawl|spider|slurp|crawler|fetch|monitor|preview|prerender|headless|http[-_]?client|curl|wget|python-requests/i;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel previews (subdomains of vercel.app) for the site project
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".vercel.app")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allow = isAllowedOrigin(origin)
    ? origin!
    : "https://farleycreative.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const ua = request.headers.get("user-agent") ?? "";

  // Bot filter: cheap heuristic, drops common crawlers silently.
  if (!ua || BOT_RE.test(ua)) {
    return new Response(null, { status: 204, headers });
  }

  let body: { path?: string; referrer?: string | null; site_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad-json" },
      { status: 400, headers },
    );
  }

  const site_id = (body.site_id || "farleycreative.com").slice(0, 100);
  const path = (body.path || "/").slice(0, 500);
  const referrer = normalizeReferrer(body.referrer ?? null, site_id);

  // Country from Vercel geo header.
  const country = request.headers.get("x-vercel-ip-country") || null;

  // Visitor ID: SHA-256 of (IP + UA + salt + UTC date), truncated to 16 chars.
  // Daily rotation means visitors can't be tracked across days — privacy-aligned.
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0";
  const today = new Date().toISOString().slice(0, 10);
  const salt = process.env.AUTH_HMAC_SECRET || "fallback-salt";
  const visitor_id = createHash("sha256")
    .update(`${ip}|${ua}|${today}|${salt}`)
    .digest("hex")
    .slice(0, 16);

  try {
    await recordPageview({ site_id, path, referrer, country, visitor_id });
  } catch (err) {
    console.warn("[/api/track] insert failed", err);
    // Swallow — tracking failure should never break the caller.
  }

  return new Response(null, { status: 204, headers });
}

/**
 * Normalize a referrer URL:
 *   - null / empty / unparseable → null
 *   - same-site (any subdomain of the site host) → null (internal nav)
 *   - external → "https://host" only (no path, no query, no fragment)
 */
function normalizeReferrer(raw: string | null, site_id: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const ownHost = site_id.replace(/^https?:\/\//, "").split("/")[0];
    if (u.hostname === ownHost || u.hostname.endsWith(`.${ownHost}`)) {
      return null;
    }
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}
