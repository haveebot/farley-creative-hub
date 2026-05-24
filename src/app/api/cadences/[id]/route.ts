/**
 * Single cadence API.
 *
 *   GET    /api/cadences/[id]   — cadence + steps
 *   PATCH  /api/cadences/[id]   — update top-level fields
 *   DELETE /api/cadences/[id]   — delete cadence (cascades to steps)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  deleteCadence,
  getCadenceWithSteps,
  updateCadence,
} from "@/lib/db/cadences";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const cadence = await getCadenceWithSteps(Number(id));
  if (!cadence) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, cadence });
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

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (body.brand_kit_id === null || typeof body.brand_kit_id === "number") {
    updates.brand_kit_id = body.brand_kit_id;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cadence = await updateCadence(Number(id), updates as any);
    return NextResponse.json({ ok: true, cadence });
  } catch (err) {
    console.error("[api/cadences PATCH] failed", err);
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
  try {
    await deleteCadence(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/cadences DELETE] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
