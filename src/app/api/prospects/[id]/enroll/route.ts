/**
 * Enroll a prospect in a cadence.
 *
 *   POST /api/prospects/[id]/enroll   { cadence_id }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createEnrollment } from "@/lib/db/enrollments";
import { logActivity } from "@/lib/db/prospects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const prospectId = Number(id);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const cadenceId =
    typeof body.cadence_id === "number" ? body.cadence_id : Number(body.cadence_id);
  if (!cadenceId || !Number.isFinite(cadenceId)) {
    return NextResponse.json(
      { ok: false, error: "cadence-id-required" },
      { status: 400 },
    );
  }

  const enrolledBy = auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;

  try {
    const enrollment = await createEnrollment({
      prospect_id: prospectId,
      cadence_id: cadenceId,
      enrolled_by: enrolledBy,
    });
    await logActivity({
      prospect_id: prospectId,
      kind: "note",
      content: `Enrolled in cadence #${cadenceId}`,
      created_by: enrolledBy,
    });
    return NextResponse.json({ ok: true, enrollment });
  } catch (err) {
    const message = (err as Error).message;
    // Unique-active-enrollment violation surfaces as a Postgres unique index error.
    if (message.includes("prospect_enrollments_active_idx")) {
      return NextResponse.json(
        {
          ok: false,
          error: "already-enrolled",
          message: "This prospect already has an active enrollment.",
        },
        { status: 409 },
      );
    }
    console.error("[api/prospects/enroll POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message },
      { status: 500 },
    );
  }
}
