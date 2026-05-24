/**
 *   PUT    /api/prospects/[id]/contacts/[contactId]
 *   DELETE /api/prospects/[id]/contacts/[contactId]
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { deleteContact, updateContact, type ContactRole, type ContactUpdate } from "@/lib/db/prospects";
import { CONTACT_ROLES } from "@/lib/pipeline-shared";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { contactId } = await params;
  const numId = parseInt(contactId, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: ContactUpdate = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.email === "string") updates.email = body.email.trim() || null;
  if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
  if (typeof body.role === "string" && (CONTACT_ROLES as string[]).includes(body.role)) {
    updates.role = body.role as ContactRole;
  }
  if (body.is_primary === true || body.is_primary === false) {
    updates.is_primary = body.is_primary;
  }
  if (typeof body.notes === "string") updates.notes = body.notes;

  try {
    const contact = await updateContact(numId, updates);
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error("[api/contacts PUT] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { contactId } = await params;
  const numId = parseInt(contactId, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }
  await deleteContact(numId);
  return NextResponse.json({ ok: true });
}
