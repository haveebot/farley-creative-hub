/**
 * Prospects API.
 *
 *   GET  /api/prospects   — list, optional ?status / ?state / ?industry / ?size / ?service
 *   POST /api/prospects   — create
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  createProspect,
  listProspects,
  type ProspectIndustry,
  type ProspectListFilter,
  type ProspectSize,
  type ProspectStatus,
  type ServiceInterest,
} from "@/lib/db/prospects";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
  SERVICE_INTERESTS,
} from "@/lib/pipeline-shared";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const filter: ProspectListFilter = {};
  const status = url.searchParams.get("status");
  const state = url.searchParams.get("state");
  const industry = url.searchParams.get("industry");
  const size = url.searchParams.get("size");
  const service = url.searchParams.get("service");

  if (status && (PROSPECT_STATUSES as string[]).includes(status)) {
    filter.status = status as ProspectStatus;
  }
  if (state) filter.state = state.toUpperCase();
  if (industry && (PROSPECT_INDUSTRIES as string[]).includes(industry)) {
    filter.industry = industry as ProspectIndustry;
  }
  if (size && (PROSPECT_SIZES as string[]).includes(size)) {
    filter.size = size as ProspectSize;
  }
  if (service && (SERVICE_INTERESTS as string[]).includes(service)) {
    filter.service = service as ServiceInterest;
  }

  const prospects = await listProspects(filter);
  return NextResponse.json({ prospects });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const business_name = typeof body.business_name === "string" ? body.business_name.trim() : "";
  if (!business_name) {
    return NextResponse.json({ ok: false, error: "business-name-required" }, { status: 400 });
  }

  const input = {
    business_name,
    industry: pickEnum(body.industry, PROSPECT_INDUSTRIES as readonly string[]),
    size: pickEnum(body.size, PROSPECT_SIZES as readonly string[]),
    city: typeof body.city === "string" ? body.city.trim() || null : null,
    state: typeof body.state === "string" ? body.state.trim().toUpperCase() || null : null,
    website_url: typeof body.website_url === "string" ? body.website_url.trim() || null : null,
    status: pickEnum(body.status, PROSPECT_STATUSES as readonly string[]) ?? "lead",
    service_interest: Array.isArray(body.service_interest)
      ? (body.service_interest as unknown[]).filter(
          (s): s is string =>
            typeof s === "string" && (SERVICE_INTERESTS as string[]).includes(s),
        )
      : [],
    notes: typeof body.notes === "string" ? body.notes : "",
    next_action: typeof body.next_action === "string" ? body.next_action.trim() || null : null,
    next_action_date:
      typeof body.next_action_date === "string" ? body.next_action_date || null : null,
    source: pickEnum(body.source, PROSPECT_SOURCES as readonly string[]),
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prospect = await createProspect(input as any);
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    console.error("[api/prospects POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function pickEnum(value: unknown, options: readonly string[]): string | null {
  if (typeof value !== "string") return null;
  return options.includes(value) ? value : null;
}
