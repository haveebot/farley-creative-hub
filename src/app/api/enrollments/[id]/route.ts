/**
 * Enrollment actions.
 *
 *   GET    /api/enrollments/[id]   — enrollment + sends
 *   PATCH  /api/enrollments/[id]   { action: 'pause' | 'resume' | 'cancel', reason? }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  cancelEnrollment,
  getEnrollment,
  listSendsForEnrollment,
  pauseEnrollment,
  resumeEnrollment,
} from "@/lib/db/enrollments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const enrollment = await getEnrollment(Number(id));
  if (!enrollment) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const sends = await listSendsForEnrollment(enrollment.id);
  return NextResponse.json({ ok: true, enrollment, sends });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const enrollmentId = Number(id);

  try {
    let enrollment;
    switch (action) {
      case "pause":
        enrollment = await pauseEnrollment(enrollmentId);
        break;
      case "resume":
        enrollment = await resumeEnrollment(enrollmentId);
        break;
      case "cancel":
        enrollment = await cancelEnrollment(enrollmentId, reason);
        break;
      default:
        return NextResponse.json(
          { ok: false, error: "invalid-action" },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true, enrollment });
  } catch (err) {
    console.error(`[api/enrollments PATCH ${action}] failed`, err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
