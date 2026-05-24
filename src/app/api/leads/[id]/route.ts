/**
 *   GET    /api/leads/[id]
 *   PUT    /api/leads/[id]
 *   DELETE /api/leads/[id]
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  deleteLead,
  getLead,
  updateLead,
  type LeadSourceType,
  type LeadStatus,
  type LeadUpdate,
} from "@/lib/db/leads";
import { LEAD_SOURCE_TYPES, LEAD_STATUSES } from "@/lib/leads-shared";

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
  const lead = await getLead(numId);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
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

  const updates: LeadUpdate = {};
  if (typeof body.source_type === "string" && (LEAD_SOURCE_TYPES as string[]).includes(body.source_type)) {
    updates.source_type = body.source_type as LeadSourceType;
  }
  if (typeof body.source_url === "string") updates.source_url = body.source_url.trim() || null;
  if (typeof body.source_title === "string") updates.source_title = body.source_title.trim() || null;
  if (typeof body.business_name === "string") updates.business_name = body.business_name.trim() || null;
  if (typeof body.city === "string") updates.city = body.city.trim() || null;
  if (typeof body.state === "string") updates.state = body.state.trim().toUpperCase() || null;
  if (typeof body.industry === "string") updates.industry = body.industry.trim() || null;
  if (typeof body.size === "string") updates.size = body.size.trim() || null;
  if (Array.isArray(body.service_signal)) {
    updates.service_signal = (body.service_signal as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
  }
  if (typeof body.raw_content === "string") updates.raw_content = body.raw_content;
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (typeof body.status === "string" && (LEAD_STATUSES as string[]).includes(body.status)) {
    updates.status = body.status as LeadStatus;
  }

  try {
    const lead = await updateLead(numId, updates);
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error("[api/leads PUT] failed", err);
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
  await deleteLead(numId);
  return NextResponse.json({ ok: true });
}
