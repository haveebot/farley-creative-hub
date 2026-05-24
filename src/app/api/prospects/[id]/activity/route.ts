/**
 *   GET  /api/prospects/[id]/activity   — list activity for prospect
 *   POST /api/prospects/[id]/activity   — log an activity
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { listActivity, logActivity, type ActivityKind } from "@/lib/db/prospects";
import { ACTIVITY_KIND_LABELS } from "@/lib/pipeline-shared";

const ACTIVITY_KINDS = Object.keys(ACTIVITY_KIND_LABELS) as ActivityKind[];

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
  const activity = await listActivity(numId);
  return NextResponse.json({ activity });
}

export async function POST(
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

  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!(ACTIVITY_KINDS as string[]).includes(kind)) {
    return NextResponse.json(
      { ok: false, error: "invalid-kind", message: `kind must be one of ${ACTIVITY_KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const row = await logActivity({
      prospect_id: numId,
      kind: kind as ActivityKind,
      content: typeof body.content === "string" ? body.content : "",
      draft_id: typeof body.draft_id === "number" ? body.draft_id : null,
      created_by: createdByLabel(auth),
    });
    return NextResponse.json({ ok: true, activity: row });
  } catch (err) {
    console.error("[api/activity POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
