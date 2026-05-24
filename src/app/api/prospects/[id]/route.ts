/**
 *   GET    /api/prospects/[id]
 *   PUT    /api/prospects/[id]
 *   DELETE /api/prospects/[id]
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  deleteProspect,
  getProspect,
  updateProspect,
  type ProspectIndustry,
  type ProspectSize,
  type ProspectStatus,
  type ProspectUpdate,
  type ServiceInterest,
} from "@/lib/db/prospects";
import {
  PROSPECT_INDUSTRIES,
  PROSPECT_SIZES,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
  SERVICE_INTERESTS,
} from "@/lib/pipeline-shared";

export async function GET(
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
  const prospect = await getProspect(numId);
  if (!prospect) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ prospect });
}

export async function PUT(
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: ProspectUpdate = {};
  if (typeof body.business_name === "string") updates.business_name = body.business_name.trim();
  if (typeof body.industry === "string" && (PROSPECT_INDUSTRIES as string[]).includes(body.industry)) {
    updates.industry = body.industry as ProspectIndustry;
  } else if (body.industry === null) {
    updates.industry = null;
  }
  if (typeof body.size === "string" && (PROSPECT_SIZES as string[]).includes(body.size)) {
    updates.size = body.size as ProspectSize;
  } else if (body.size === null) {
    updates.size = null;
  }
  if (typeof body.city === "string") updates.city = body.city.trim() || null;
  if (typeof body.state === "string") updates.state = body.state.trim().toUpperCase() || null;
  if (typeof body.website_url === "string") updates.website_url = body.website_url.trim() || null;
  if (typeof body.status === "string" && (PROSPECT_STATUSES as string[]).includes(body.status)) {
    updates.status = body.status as ProspectStatus;
  }
  if (Array.isArray(body.service_interest)) {
    updates.service_interest = (body.service_interest as unknown[]).filter(
      (s): s is ServiceInterest =>
        typeof s === "string" && (SERVICE_INTERESTS as string[]).includes(s),
    ) as ServiceInterest[];
  }
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (typeof body.next_action === "string") updates.next_action = body.next_action.trim() || null;
  if (typeof body.next_action_date === "string" || body.next_action_date === null) {
    updates.next_action_date = (body.next_action_date as string | null) || null;
  }
  if (typeof body.source === "string" && (PROSPECT_SOURCES as string[]).includes(body.source)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updates.source = body.source as any;
  }

  try {
    const prospect = await updateProspect(numId, updates);
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    console.error("[api/prospects PUT] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
  await deleteProspect(numId);
  return NextResponse.json({ ok: true });
}
