/**
 * Cadences API.
 *
 *   GET  /api/cadences   — list (active only by default; ?all=1 for inactive too)
 *   POST /api/cadences   — create
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createCadence, listCadences } from "@/lib/db/cadences";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("all") === "1";
  const cadences = await listCadences(includeInactive);
  return NextResponse.json({ cadences });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "name-required" }, { status: 400 });
  }

  const createdBy = auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;

  try {
    const cadence = await createCadence({
      name,
      description: typeof body.description === "string" ? body.description : "",
      brand_kit_id:
        typeof body.brand_kit_id === "number" ? body.brand_kit_id : null,
      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
      created_by: createdBy,
    });
    return NextResponse.json({ ok: true, cadence });
  } catch (err) {
    console.error("[api/cadences POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
