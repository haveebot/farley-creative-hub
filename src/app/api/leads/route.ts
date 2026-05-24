/**
 * Leads API.
 *
 *   GET  /api/leads   — list, optional ?status / ?source_type / ?state
 *   POST /api/leads   — create
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import {
  createLead,
  listLeads,
  type LeadListFilter,
  type LeadSourceType,
  type LeadStatus,
} from "@/lib/db/leads";
import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUSES,
} from "@/lib/leads-shared";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const filter: LeadListFilter = {};
  const status = url.searchParams.get("status");
  const sourceType = url.searchParams.get("source_type");
  const state = url.searchParams.get("state");

  if (status && (LEAD_STATUSES as string[]).includes(status)) {
    filter.status = status as LeadStatus;
  }
  if (sourceType && (LEAD_SOURCE_TYPES as string[]).includes(sourceType)) {
    filter.source_type = sourceType as LeadSourceType;
  }
  if (state) filter.state = state.toUpperCase();

  const leads = await listLeads(filter);
  return NextResponse.json({ leads });
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

  const sourceTypeRaw = typeof body.source_type === "string" ? body.source_type : "other";
  const source_type: LeadSourceType = (LEAD_SOURCE_TYPES as string[]).includes(sourceTypeRaw)
    ? (sourceTypeRaw as LeadSourceType)
    : "other";

  try {
    const lead = await createLead({
      source_type,
      source_url: typeof body.source_url === "string" ? body.source_url.trim() || null : null,
      source_title: typeof body.source_title === "string" ? body.source_title.trim() || null : null,
      business_name: typeof body.business_name === "string" ? body.business_name.trim() || null : null,
      city: typeof body.city === "string" ? body.city.trim() || null : null,
      state:
        typeof body.state === "string" ? body.state.trim().toUpperCase() || null : null,
      industry: typeof body.industry === "string" ? body.industry.trim() || null : null,
      size: typeof body.size === "string" ? body.size.trim() || null : null,
      service_signal: Array.isArray(body.service_signal)
        ? (body.service_signal as unknown[]).filter((s): s is string => typeof s === "string")
        : [],
      raw_content: typeof body.raw_content === "string" ? body.raw_content : "",
      notes: typeof body.notes === "string" ? body.notes : "",
      status: undefined,
      found_by: foundByLabel(auth),
    });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error("[api/leads POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function foundByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
