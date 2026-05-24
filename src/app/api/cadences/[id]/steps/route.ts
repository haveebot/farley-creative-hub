/**
 * Cadence steps — create.
 *
 *   POST /api/cadences/[id]/steps   — add a step at the end of the cadence
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createStep, listSteps } from "@/lib/db/cadences";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const cadenceId = Number(id);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const draftPrompt = typeof body.draft_prompt === "string" ? body.draft_prompt.trim() : "";
  if (!draftPrompt) {
    return NextResponse.json(
      { ok: false, error: "draft-prompt-required" },
      { status: 400 },
    );
  }

  // Append at end: step_number = current max + 1.
  const existing = await listSteps(cadenceId);
  const nextStepNumber = existing.length + 1;

  try {
    const step = await createStep({
      cadence_id: cadenceId,
      step_number: nextStepNumber,
      delay_days: typeof body.delay_days === "number" ? body.delay_days : 0,
      delay_hours: typeof body.delay_hours === "number" ? body.delay_hours : 0,
      draft_prompt: draftPrompt,
      subject_template:
        typeof body.subject_template === "string"
          ? body.subject_template.trim() || null
          : null,
    });
    return NextResponse.json({ ok: true, step });
  } catch (err) {
    console.error("[api/cadences/steps POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
