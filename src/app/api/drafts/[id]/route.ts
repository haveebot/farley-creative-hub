/**
 *   GET    /api/drafts/[id]   — fetch one
 *   PUT    /api/drafts/[id]   — update title / kind / status / content
 *   DELETE /api/drafts/[id]   — delete
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  DRAFT_KINDS,
  DRAFT_STATUSES,
  deleteDraft,
  getDraft,
  updateDraft,
  type DraftKind,
  type DraftStatus,
  type DraftUpdate,
} from "@/lib/db/drafts";

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

  const draft = await getDraft(numId);
  if (!draft) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
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

  const updates: DraftUpdate = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.content === "string") updates.content = body.content;
  if (
    typeof body.kind === "string" &&
    (DRAFT_KINDS as string[]).includes(body.kind)
  ) {
    updates.kind = body.kind as DraftKind;
  }
  if (
    typeof body.status === "string" &&
    (DRAFT_STATUSES as string[]).includes(body.status)
  ) {
    updates.status = body.status as DraftStatus;
  }

  try {
    const updated = await updateDraft(numId, updates);
    return NextResponse.json({ ok: true, draft: updated });
  } catch (err) {
    console.error("[api/drafts PUT] failed", err);
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

  await deleteDraft(numId);
  return NextResponse.json({ ok: true });
}
