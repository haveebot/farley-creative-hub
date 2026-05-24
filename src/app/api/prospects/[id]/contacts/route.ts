/**
 *   GET  /api/prospects/[id]/contacts   — list contacts for prospect
 *   POST /api/prospects/[id]/contacts   — add a contact
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createContact, listContacts, type ContactRole } from "@/lib/db/prospects";
import { CONTACT_ROLES } from "@/lib/pipeline-shared";

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
  const contacts = await listContacts(numId);
  return NextResponse.json({ contacts });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "name-required" }, { status: 400 });
  }

  const role = typeof body.role === "string" && (CONTACT_ROLES as string[]).includes(body.role)
    ? (body.role as ContactRole)
    : null;

  try {
    const contact = await createContact({
      prospect_id: numId,
      name,
      email: typeof body.email === "string" ? body.email.trim() || null : null,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      role,
      is_primary: body.is_primary === true,
      notes: typeof body.notes === "string" ? body.notes : "",
    });
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error("[api/contacts POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
