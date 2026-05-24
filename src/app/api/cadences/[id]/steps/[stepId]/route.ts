/**
 * Single cadence step.
 *
 *   PATCH  /api/cadences/[id]/steps/[stepId]   — update step
 *   DELETE /api/cadences/[id]/steps/[stepId]   — delete step + renumber
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { deleteStep, renumberSteps, updateStep } from "@/lib/db/cadences";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { stepId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.delay_days === "number") updates.delay_days = body.delay_days;
  if (typeof body.delay_hours === "number") updates.delay_hours = body.delay_hours;
  if (typeof body.draft_prompt === "string" && body.draft_prompt.trim()) {
    updates.draft_prompt = body.draft_prompt.trim();
  }
  if (body.subject_template === null || typeof body.subject_template === "string") {
    updates.subject_template =
      typeof body.subject_template === "string"
        ? body.subject_template.trim() || null
        : null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = await updateStep(Number(stepId), updates as any);
    return NextResponse.json({ ok: true, step });
  } catch (err) {
    console.error("[api/cadences/steps PATCH] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id, stepId } = await params;
  try {
    await deleteStep(Number(stepId));
    await renumberSteps(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/cadences/steps DELETE] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
